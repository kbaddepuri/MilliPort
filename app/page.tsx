"use client";

import { useEffect, useMemo, useState } from "react";
import { portfolio, TARGET_VALUE, TOTAL_PNL } from "@/lib/portfolio";
import type { Quote } from "@/lib/market-data/types";
import { runDecisionEngine, topActionablePicks, strategyUniverse, type AgentPick } from "@/lib/decision-engine";
import {
  emptyPortfolioState,
  positionFor,
  STORAGE_KEY,
  upsertPosition,
  type PortfolioState,
  type Recommendation,
} from "@/lib/portfolio-state";

const money = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
const preciseMoney = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(n);
const sharesText = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 6 });
const QUOTE_REFRESH_MS = 30_000;
const QUOTE_REFRESH_SECONDS = QUOTE_REFRESH_MS / 1000;

type HoldingView = { ticker: string; name: string; snapshotValue: number; action: "BUY" | "HOLD" | "WATCH" | "SELL" | "EXIT"; actionAmount: number; thesis: string };

export default function Home() {
  const [quotes, setQuotes] = useState<Record<string, Quote>>({});
  const [marketState, setMarketState] = useState<"loading" | "live" | "unconfigured" | "error">("loading");
  const [message, setMessage] = useState("");
  const [state, setState] = useState<PortfolioState>(() => emptyPortfolioState());
  const [hydrated, setHydrated] = useState(false);
  const [notice, setNotice] = useState("");
  const [refreshCountdown, setRefreshCountdown] = useState(QUOTE_REFRESH_SECONDS);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshNonce, setRefreshNonce] = useState(0);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) setState(JSON.parse(saved) as PortfolioState);
    } catch {
      setNotice("Saved portfolio state could not be read; using a fresh M4 state.");
    } finally { setHydrated(true); }
  }, []);

  useEffect(() => { if (hydrated) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }, [state, hydrated]);

  useEffect(() => {
    let cancelled = false;
    let refreshInProgress = false;
    const symbols = Array.from(new Set([
      ...strategyUniverse.map((candidate) => candidate.ticker),
      ...portfolio.map((holding) => holding.ticker),
      ...state.positions.map((position) => position.ticker),
      ...state.recommendations.filter((r) => r.status === "PENDING").map((r) => r.ticker),
    ]));
    const refreshQuotes = async () => {
      if (refreshInProgress) return;
      refreshInProgress = true;
      setIsRefreshing(true);
      try {
        const response = await fetch(`/api/quotes?symbols=${encodeURIComponent(symbols.join(","))}`, { cache: "no-store" });
        const data = await response.json();
        if (cancelled) return;
        if (!response.ok) {
          setMarketState(data.error === "MARKET_DATA_NOT_CONFIGURED" ? "unconfigured" : "error");
          setMessage(data.message ?? "Market data unavailable.");
          return;
        }
        setQuotes(Object.fromEntries((data.quotes as Quote[]).map((quote) => [quote.ticker, quote])));
        setMarketState("live");
        setMessage(`Updated ${new Date(data.fetchedAt).toLocaleTimeString()}`);
      } catch {
        if (!cancelled) { setMarketState("error"); setMessage("Could not reach the market-data API."); }
      } finally {
        if (!cancelled) { setIsRefreshing(false); setRefreshCountdown(QUOTE_REFRESH_SECONDS); }
        refreshInProgress = false;
      }
    };
    refreshQuotes();
    const countdownId = window.setInterval(() => {
      setRefreshCountdown((current) => {
        if (current <= 1) { void refreshQuotes(); return QUOTE_REFRESH_SECONDS; }
        return current - 1;
      });
    }, 1000);
    return () => { cancelled = true; window.clearInterval(countdownId); };
  }, [state.positions, state.recommendations, refreshNonce]);

  const pending = state.recommendations.filter((r) => r.status === "PENDING");
  const decided = state.recommendations.filter((r) => r.status !== "PENDING");
  const agentPicks = useMemo(() => runDecisionEngine(state, quotes), [state, quotes]);
  const actionablePicks = useMemo(() => topActionablePicks(agentPicks, 6), [agentPicks]);

  function derivedShares(ticker: string, snapshotValue: number) {
    const quote = quotes[ticker];
    return quote && quote.price > 0 ? snapshotValue / quote.price : undefined;
  }
  function effectiveShares(ticker: string, snapshotValue: number) {
    const position = positionFor(state, ticker);
    return position ? position.shares : derivedShares(ticker, snapshotValue) ?? 0;
  }

  const holdingViews = useMemo<HoldingView[]>(() => {
    const base = portfolio.map((holding) => ({ ticker: holding.ticker, name: holding.name, snapshotValue: holding.value, action: holding.action, actionAmount: holding.actionAmount, thesis: holding.thesis }));
    for (const position of state.positions) if (!base.some((holding) => holding.ticker === position.ticker)) {
      base.push({ ticker: position.ticker, name: `${position.ticker} position`, snapshotValue: position.shares * (quotes[position.ticker]?.price ?? 0), action: "HOLD", actionAmount: 0, thesis: "Approved position; included in portfolio state." });
    }
    return base;
  }, [state.positions, quotes]);

  const portfolioValue = useMemo(() => holdingViews.reduce((sum, holding) => {
    const position = positionFor(state, holding.ticker);
    const quote = quotes[holding.ticker];
    return sum + (position && quote ? position.shares * quote.price : holding.snapshotValue);
  }, state.cash), [holdingViews, state, quotes]);
  const progress = Math.min(100, portfolioValue / TARGET_VALUE * 100);
  const gap = Math.max(0, TARGET_VALUE - portfolioValue);
  const investedValue = portfolioValue - state.cash;
  const approvedCount = state.transactions.length;

  function queueAgentPick(pick: AgentPick) {
    if (pick.action !== "BUY" && pick.action !== "SELL") return;
    if (pick.amount <= 0) { setNotice(`${pick.ticker} is not currently actionable with a dollar allocation.`); return; }
    if (state.recommendations.some((r) => r.status === "PENDING" && r.ticker === pick.ticker && r.action === pick.action)) {
      setNotice(`${pick.ticker} ${pick.action} is already waiting for your approval.`); return;
    }
    const recommendation: Recommendation = {
      id: `agent-${pick.ticker}-${pick.action.toLowerCase()}-${Date.now()}`,
      ticker: pick.ticker, action: pick.action, amount: pick.amount, thesis: `${pick.thesis} ${pick.rationale}`,
      status: "PENDING", createdAt: new Date().toISOString(),
    };
    setState((current) => ({ ...current, recommendations: [...current.recommendations, recommendation] }));
    setNotice(`${pick.action} ${pick.ticker} for ${money(pick.amount)} queued for human approval. No order was placed.`);
  }

  function setManualShares(ticker: string, raw: string) {
    const value = raw.trim();
    const current = positionFor(state, ticker);
    if (value === "") {
      if (current?.source === "MANUAL") { setState((s) => upsertPosition(s, { ...current, source: "DERIVED" })); setNotice(`${ticker} returned to automatic share derivation.`); }
      return;
    }
    const shares = Number(value);
    if (!Number.isFinite(shares) || shares < 0) return;
    setState((s) => upsertPosition(s, { ticker, shares, avgCost: current?.avgCost ?? 0, source: "MANUAL" }));
    setNotice(`${ticker} broker quantity set to ${sharesText(shares)} shares.`);
  }

  function approveRecommendation(rec: Recommendation) {
    const quote = quotes[rec.ticker];
    if (!quote || quote.price <= 0) { setNotice(`Cannot approve ${rec.ticker}: a live price is required.`); return; }
    const position = positionFor(state, rec.ticker);
    const knownHolding = portfolio.find((h) => h.ticker === rec.ticker);
    const availableShares = position?.shares ?? (knownHolding ? derivedShares(rec.ticker, knownHolding.value) : 0) ?? 0;
    const shares = rec.amount / quote.price;
    if (rec.action === "SELL") {
      if (availableShares <= 0) { setNotice(`Cannot approve ${rec.ticker} sale: no known holding quantity.`); return; }
      if (shares > availableShares + 1e-9) { setNotice(`Cannot approve: ${rec.ticker} sale needs ${sharesText(shares)} shares but only ${sharesText(availableShares)} are available.`); return; }
    }
    if (rec.action === "BUY" && state.cash < rec.amount) { setNotice(`Insufficient recorded cash for ${rec.ticker}. Approve planned sales first or update cash.`); return; }
    const now = new Date().toISOString();
    let next = { ...state };
    if (rec.action === "BUY") {
      const oldShares = position?.shares ?? 0;
      const oldCost = position?.avgCost ?? 0;
      const totalCost = oldShares * oldCost + rec.amount;
      next = upsertPosition(next, { ticker: rec.ticker, shares: oldShares + shares, avgCost: totalCost / (oldShares + shares), source: "DERIVED" });
      next.cash -= rec.amount;
    } else if (rec.action === "SELL") {
      next = upsertPosition(next, { ticker: rec.ticker, shares: Math.max(0, availableShares - shares), avgCost: position?.avgCost ?? 0, source: position?.source ?? "DERIVED" });
      next.cash += rec.amount;
    }
    next.transactions = [...next.transactions, { id: `txn-${Date.now()}`, ticker: rec.ticker, side: rec.action === "BUY" ? "BUY" : "SELL", shares, price: quote.price, amount: rec.amount, createdAt: now, source: "AGENT" }];
    next.recommendations = next.recommendations.map((item) => item.id === rec.id ? { ...item, status: "APPROVED", decidedAt: now } : item);
    setState(next);
    setNotice(`${rec.action} ${rec.ticker} for ${money(rec.amount)} approved and recorded. No broker order was placed.`);
  }

  function rejectRecommendation(rec: Recommendation) {
    const now = new Date().toISOString();
    setState({ ...state, recommendations: state.recommendations.map((item) => item.id === rec.id ? { ...item, status: "REJECTED", decidedAt: now } : item) });
    setNotice(`${rec.ticker} ${rec.action} recommendation rejected.`);
  }

  function resetM4() {
    if (!window.confirm("Reset MilliPort M4 local state? This removes recorded transactions, positions, cash changes, and decisions in this browser.")) return;
    setState(emptyPortfolioState());
    setNotice("M4 local state reset.");
  }

  return <main className="shell">
    <header className="topbar">
      <div><div className="brand">Milli<span>Port</span></div><div className="subbrand">Portfolio Decision Engine</div></div>
      <div className="topbar-right">
        <div className={`refresh-status ${isRefreshing ? "refreshing" : ""}`} aria-live="polite"><span className="refresh-dot">●</span>{isRefreshing ? "Refreshing…" : marketState === "live" ? `LIVE · Refresh in ${refreshCountdown}s` : `Refresh in ${refreshCountdown}s`}<button className="refresh-button" type="button" onClick={() => setRefreshNonce((value) => value + 1)} aria-label="Refresh market data now" title="Refresh market data now">↻</button></div>
        <div className="badge">V4 · M4 AGENT</div>
      </div>
    </header>

    <section className="hero">
      <div className="panel"><div className="eyebrow">Strategy-driven Portfolio Growth Engine</div><h1>Build toward <span className="positive">$30K.</span></h1><p>MilliPort now evaluates an explicit strategy universe, scores every candidate, considers current portfolio exposure and capital-rotation room, and produces dollar-sized BUY/HOLD/WATCH/SELL decisions. It never randomly selects a ticker.</p></div>
      <div className="panel target"><div className="eyebrow">Mission progress</div><div className="value">{money(portfolioValue)}</div><div className="muted">of {money(TARGET_VALUE)}</div><div className="progress"><i style={{ width: `${progress}%` }} /></div><div className="muted">{progress.toFixed(1)}% · {money(gap)} remaining</div></div>
    </section>

    <section className="grid">
      <div className="panel metric"><div className="label">Portfolio value</div><div className="number">{money(portfolioValue)}</div><div className="reason">{marketState === "live" ? "Live quotes × effective shares + cash" : "Snapshot until live quotes are configured"}</div></div>
      <div className="panel metric"><div className="label">Recorded cash</div><div className="number">{money(state.cash)}</div><div className="reason">Updated only by approved transactions</div></div>
      <div className="panel metric"><div className="label">Strategy universe</div><div className="number">{strategyUniverse.length}</div><div className="reason">Deterministic candidates evaluated</div></div>
      <div className="panel metric"><div className="label">Pending approvals</div><div className="number">{pending.length}</div><div className="reason">Nothing executes automatically</div></div>
    </section>

    {(notice || message) && <div className="notice">{notice || message}</div>}

    <section className="panel">
      <div className="eyebrow">M4 Agent Decision Engine</div><h2>What the strategy wants next</h2>
      <p className="section-note">Every quote refresh re-evaluates the same explicit scoring model. The score is based on growth, quality, catalyst strength, strategic fit, asymmetry and risk. Portfolio caps and deliberate risk controls are applied after scoring. <strong>Queue</strong> only adds a recommendation to the human approval gate; it never places a broker order.</p>
      {actionablePicks.length === 0 ? <div className="empty">Waiting for live prices before the agent can size actions.</div> : <div className="approval-list">
        {actionablePicks.map((pick) => <div className="approval" key={`${pick.ticker}-${pick.action}`}>
          <div><div className="ticker">#{pick.rank} · {pick.ticker}</div><div className="reason">{pick.name} · {pick.thesis}</div></div>
          <div className={`action ${pick.action.toLowerCase()}`}>{pick.action} {money(pick.amount)}</div>
          <div className="approval-meta"><span>Score {pick.score}/100</span><span>{pick.price ? preciseMoney(pick.price) : "Price unavailable"}</span>{pick.shares ? <span>≈ {sharesText(pick.shares)} shares</span> : null}</div>
          <div className="reason">{pick.rationale}</div>
          <div className="actions">{pick.amount > 0 && <button className="approve" onClick={() => queueAgentPick(pick)}>Queue for approval</button>}</div>
        </div>)}
      </div>}
      <div className="reason" style={{ marginTop: 12 }}>Decision cycle: live quote-driven evaluation · Human approval: ON · Auto-approval: OFF · Broker execution: OFF</div>
    </section>

    <section className="panel" style={{ marginTop: 18 }}>
      <div className="eyebrow">Human approval gate</div><h2>Pending actions</h2>
      <p className="section-note">Approve the <strong>dollar amount</strong>. MilliPort calculates the required shares at the current live price. After approval, the resulting position is immediately included in Holdings &amp; Portfolio Value.</p>
      {pending.length === 0 ? <div className="empty">No pending recommendations. The portfolio is waiting for the next agent decision.</div> : <div className="approval-list">
        {pending.map((rec) => { const q = quotes[rec.ticker]; const position = positionFor(state, rec.ticker); const knownHolding = portfolio.find((h) => h.ticker === rec.ticker); const availableShares = position?.shares ?? (knownHolding && q ? knownHolding.value / q.price : undefined); return <div className="approval" key={rec.id}>
          <div><div className="ticker">{rec.ticker}</div><div className="reason">{rec.thesis}</div></div>
          <div className={`action ${rec.action.toLowerCase()}`}>{rec.action} {money(rec.amount)}</div>
          <div className="approval-meta"><span>{q ? preciseMoney(q.price) : "Price unavailable"}</span>{q && rec.action !== "HOLD" && <span>≈ {sharesText(rec.amount / q.price)} shares</span>}{rec.action === "SELL" && <span>Available: {availableShares !== undefined ? sharesText(availableShares) : "not available"}</span>}</div>
          <div className="actions"><button className="approve" onClick={() => approveRecommendation(rec)}>Approve</button><button className="reject" onClick={() => rejectRecommendation(rec)}>Reject</button></div>
        </div>; })}
      </div>}
    </section>

    <section className="panel" style={{ marginTop: 18 }}>
      <div className="eyebrow">Portfolio state</div><h2>Holdings &amp; share quantities</h2>
      <p className="section-note">AUTO uses MilliPort's known position and current price. MANUAL lets you enter the exact broker quantity. Manual quantities always take precedence.</p>
      <div className="table-wrap"><table className="table"><thead><tr><th>Asset</th><th>Shares</th><th>Price</th><th>Market value</th><th>Avg cost</th><th>Action</th></tr></thead><tbody>
        {holdingViews.map((h) => { const p = positionFor(state, h.ticker); const q = quotes[h.ticker]; const derived = !p || p.source === "DERIVED" ? derivedShares(h.ticker, h.snapshotValue) : undefined; const shares = effectiveShares(h.ticker, h.snapshotValue); const value = q ? shares * q.price : h.snapshotValue; return <tr key={h.ticker}>
          <td><div className="ticker">{h.ticker}</div><div className="reason">{h.name}</div></td>
          <td><div className="share-cell"><input className="shares-input" type="number" min="0" step="any" placeholder={derived !== undefined ? sharesText(derived) : "Auto"} value={p?.source === "MANUAL" ? p.shares : ""} onChange={(e) => setManualShares(h.ticker, e.target.value)} /><span className={`share-source ${p?.source === "MANUAL" ? "manual" : "derived"}`}>{p?.source === "MANUAL" ? "MANUAL" : "AUTO"}</span></div>{p?.source === "DERIVED" && <div className="reason">Approved: {sharesText(p.shares)} shares</div>}</td>
          <td>{q ? preciseMoney(q.price) : "—"}</td><td>{money(value)}</td><td>{p?.avgCost ? preciseMoney(p.avgCost) : "—"}</td><td><span className={`action ${h.action.toLowerCase()}`}>{h.action}{h.actionAmount ? ` ${money(h.actionAmount)}` : ""}</span></td>
        </tr>; })}
      </tbody></table></div>
    </section>

    <section className="grid" style={{ marginTop: 18 }}>
      <div className="panel metric"><div className="label">Snapshot P&amp;L</div><div className="number positive">+{money(TOTAL_PNL)}</div><div className="reason">Original M1 snapshot</div></div>
      <div className="panel metric"><div className="label">Invested value</div><div className="number">{money(investedValue)}</div><div className="reason">Portfolio value minus recorded cash</div></div>
      <div className="panel metric"><div className="label">Storage</div><div className="number">Browser</div><div className="reason">localStorage; database adapter comes next</div></div>
      <div className="panel metric"><div className="label">Market data</div><div className="number">{marketState === "live" ? "LIVE" : marketState === "unconfigured" ? "SETUP" : "OFFLINE"}</div><div className="reason">{message}</div></div>
    </section>

    <section className="panel history" style={{ marginTop: 18 }}>
      <div className="eyebrow">Audit trail</div><h2>Decision history</h2>
      {decided.length === 0 && state.transactions.length === 0 ? <div className="empty">No decisions yet.</div> : <>{decided.slice().reverse().map((r) => <div className="history-row" key={r.id}><span className={`action ${r.action.toLowerCase()}`}>{r.status}</span><strong>{r.ticker}</strong><span>{r.action} {money(r.amount)}</span><span className="reason">{r.decidedAt ? new Date(r.decidedAt).toLocaleString() : "—"}</span></div>)}{state.transactions.slice().reverse().map((t) => <div className="history-row" key={t.id}><span className="action hold">RECORDED</span><strong>{t.ticker}</strong><span>{t.side} {sharesText(t.shares)} @ {preciseMoney(t.price)}</span><span className="reason">{new Date(t.createdAt).toLocaleString()}</span></div>)}</>}
    </section>

    <div className="footer"><span>MilliPort V4 · M4 Agent Decision Engine · Decisions are informational and not financial advice.</span><button className="reset" onClick={resetM4}>Reset local M4 state</button></div>
  </main>;
}
