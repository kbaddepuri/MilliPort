"use client";

import { useEffect, useMemo, useState } from "react";
import { portfolio, START_VALUE, TARGET_VALUE, TOTAL_PNL } from "@/lib/portfolio";
import type { Quote } from "@/lib/market-data/types";
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

export default function Home() {
  const [quotes, setQuotes] = useState<Record<string, Quote>>({});
  const [marketState, setMarketState] = useState<"loading" | "live" | "unconfigured" | "error">("loading");
  const [message, setMessage] = useState("");
  const [state, setState] = useState<PortfolioState>(() => emptyPortfolioState());
  const [hydrated, setHydrated] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) setState(JSON.parse(saved) as PortfolioState);
    } catch {
      setNotice("Saved portfolio state could not be read; using a fresh M3 state.");
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (hydrated) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state, hydrated]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/quotes")
      .then(async (response) => {
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
      })
      .catch(() => {
        if (!cancelled) {
          setMarketState("error");
          setMessage("Could not reach the market-data API.");
        }
      });
    return () => { cancelled = true; };
  }, []);

  const pending = state.recommendations.filter((r) => r.status === "PENDING");
  const decided = state.recommendations.filter((r) => r.status !== "PENDING");

  const portfolioValue = useMemo(() => {
    return portfolio.reduce((sum, holding) => {
      const position = positionFor(state, holding.ticker);
      const quote = quotes[holding.ticker];
      if (position && quote) return sum + position.shares * quote.price;
      return sum + holding.value;
    }, 0);
  }, [state, quotes]);

  const progress = Math.min(100, portfolioValue / TARGET_VALUE * 100);
  const gap = Math.max(0, TARGET_VALUE - portfolioValue);
  const investedValue = portfolioValue - state.cash;
  const approvedCount = state.transactions.length;

  function setShares(ticker: string, raw: string) {
    const shares = Number(raw);
    if (!Number.isFinite(shares) || shares < 0) return;
    const current = positionFor(state, ticker);
    setState(upsertPosition(state, { ticker, shares, avgCost: current?.avgCost ?? 0 }));
  }

  function approveRecommendation(rec: Recommendation) {
    const quote = quotes[rec.ticker];
    if (!quote || quote.price <= 0) {
      setNotice(`Cannot approve ${rec.ticker}: a live price is required.`);
      return;
    }

    const position = positionFor(state, rec.ticker);
    const shares = rec.amount / quote.price;

    if (rec.action === "SELL") {
      if (!position || position.shares <= 0) {
        setNotice(`Enter your exact ${rec.ticker} share quantity before approving this sale.`);
        return;
      }
      if (shares > position.shares + 1e-9) {
        setNotice(`Cannot approve: ${rec.ticker} sale needs ${sharesText(shares)} shares but only ${sharesText(position.shares)} are recorded.`);
        return;
      }
    }

    if (rec.action === "BUY" && state.cash < rec.amount) {
      setNotice(`Insufficient recorded cash for ${rec.ticker}. Approve the planned sales first or update cash.`);
      return;
    }

    const now = new Date().toISOString();
    let next = { ...state };
    if (rec.action === "BUY") {
      const oldShares = position?.shares ?? 0;
      const oldCost = position?.avgCost ?? 0;
      const totalCost = oldShares * oldCost + rec.amount;
      next = upsertPosition(next, { ticker: rec.ticker, shares: oldShares + shares, avgCost: totalCost / (oldShares + shares) });
      next.cash -= rec.amount;
    } else if (rec.action === "SELL") {
      const remaining = (position?.shares ?? 0) - shares;
      next = upsertPosition(next, { ticker: rec.ticker, shares: Math.max(0, remaining), avgCost: position?.avgCost ?? 0 });
      next.cash += rec.amount;
    }

    next.transactions = [...next.transactions, {
      id: `txn-${Date.now()}`,
      ticker: rec.ticker,
      side: rec.action === "BUY" ? "BUY" : "SELL",
      shares,
      price: quote.price,
      amount: rec.amount,
      createdAt: now,
      source: "AGENT",
    }];
    next.recommendations = next.recommendations.map((item) => item.id === rec.id ? { ...item, status: "APPROVED", decidedAt: now } : item);
    setState(next);
    setNotice(`${rec.action} ${rec.ticker} for ${money(rec.amount)} approved and recorded. No broker order was placed.`);
  }

  function rejectRecommendation(rec: Recommendation) {
    const now = new Date().toISOString();
    setState({
      ...state,
      recommendations: state.recommendations.map((item) => item.id === rec.id ? { ...item, status: "REJECTED", decidedAt: now } : item),
    });
    setNotice(`${rec.ticker} ${rec.action} recommendation rejected.`);
  }

  function resetM3() {
    if (!window.confirm("Reset MilliPort M3 local state? This removes recorded transactions, positions, cash changes, and decisions in this browser.")) return;
    setState(emptyPortfolioState());
    setNotice("M3 local state reset.");
  }

  return <main className="shell">
    <header className="topbar">
      <div><div className="brand">Milli<span>Port</span></div><div className="subbrand">Portfolio Decision Engine</div></div>
      <div className="badge">V4 · M3 APPROVAL</div>
    </header>

    <section className="hero">
      <div className="panel"><div className="eyebrow">Portfolio Growth Engine</div><h1>Build toward <span className="positive">$30K.</span></h1><p>M3 adds persistent portfolio state, exact share quantities, transaction history, and a human approval gate. The agent can change recommendations without changing your holdings.</p></div>
      <div className="panel target"><div className="eyebrow">Mission progress</div><div className="value">{money(portfolioValue)}</div><div className="muted">of {money(TARGET_VALUE)}</div><div className="progress"><i style={{ width: `${progress}%` }} /></div><div className="muted">{progress.toFixed(1)}% · {money(gap)} remaining</div></div>
    </section>

    <section className="grid">
      <div className="panel metric"><div className="label">Portfolio value</div><div className="number">{money(portfolioValue)}</div><div className="reason">{marketState === "live" ? "Live quotes × recorded shares" : "Snapshot until live quotes are configured"}</div></div>
      <div className="panel metric"><div className="label">Recorded cash</div><div className="number">{money(state.cash)}</div><div className="reason">Updated only by approved transactions</div></div>
      <div className="panel metric"><div className="label">Pending approvals</div><div className="number">{pending.length}</div><div className="reason">Agent recommendations awaiting you</div></div>
      <div className="panel metric"><div className="label">Transactions</div><div className="number">{approvedCount}</div><div className="reason">Approved in MilliPort</div></div>
    </section>

    {(notice || message) && <div className="notice">{notice || message}</div>}

    <section className="panel">
      <div className="eyebrow">Human approval gate</div><h2>Pending actions</h2>
      <p className="section-note">Approve means MilliPort records the portfolio change. It does <strong>not</strong> place a trade with your broker.</p>
      {pending.length === 0 ? <div className="empty">No pending recommendations. The portfolio is waiting for the next agent decision.</div> : <div className="approval-list">
        {pending.map(rec => { const q = quotes[rec.ticker]; const position = positionFor(state, rec.ticker); return <div className="approval" key={rec.id}>
          <div><div className="ticker">{rec.ticker}</div><div className="reason">{rec.thesis}</div></div>
          <div className={`action ${rec.action.toLowerCase()}`}>{rec.action} {money(rec.amount)}</div>
          <div className="approval-meta"><span>{q ? preciseMoney(q.price) : "Price unavailable"}</span>{q && rec.action !== "HOLD" && <span>≈ {sharesText(rec.amount / q.price)} shares</span>}{rec.action === "SELL" && <span>Recorded: {position ? sharesText(position.shares) : "not set"}</span>}</div>
          <div className="actions"><button className="approve" onClick={() => approveRecommendation(rec)}>Approve</button><button className="reject" onClick={() => rejectRecommendation(rec)}>Reject</button></div>
        </div>; })}
      </div>}
    </section>

    <section className="panel" style={{ marginTop: 18 }}>
      <div className="eyebrow">Portfolio state</div><h2>Holdings &amp; exact shares</h2>
      <p className="section-note">Enter the exact share quantities from your broker. MilliPort will then value these positions using live quotes. Until a quantity is entered, the original snapshot value is retained.</p>
      <div className="table-wrap"><table className="table"><thead><tr><th>Asset</th><th>Shares</th><th>Price</th><th>Market value</th><th>Avg cost</th><th>Action</th></tr></thead><tbody>
        {portfolio.map(h => { const p = positionFor(state, h.ticker); const q = quotes[h.ticker]; const value = p && q ? p.shares * q.price : h.value; return <tr key={h.ticker}><td><div className="ticker">{h.ticker}</div><div className="reason">{h.name}</div></td><td><input className="shares-input" type="number" min="0" step="any" placeholder="Enter" value={p?.shares ?? ""} onChange={e => setShares(h.ticker, e.target.value)} /></td><td>{q ? preciseMoney(q.price) : "—"}</td><td>{money(value)}</td><td>{p?.avgCost ? preciseMoney(p.avgCost) : "—"}</td><td><span className={`action ${h.action.toLowerCase()}`}>{h.action}{h.actionAmount ? ` ${money(h.actionAmount)}` : ""}</span></td></tr>; })}
      </tbody></table></div>
    </section>

    <section className="grid" style={{ marginTop: 18 }}>
      <div className="panel metric"><div className="label">Snapshot P&amp;L</div><div className="number positive">+{money(TOTAL_PNL)}</div><div className="reason">Original M1 snapshot</div></div>
      <div className="panel metric"><div className="label">Invested value</div><div className="number">{money(investedValue)}</div><div className="reason">Portfolio value minus recorded cash</div></div>
      <div className="panel metric"><div className="label">Storage</div><div className="number">Browser</div><div className="reason">localStorage in M3; database adapter comes next</div></div>
      <div className="panel metric"><div className="label">Market data</div><div className="number">{marketState === "live" ? "LIVE" : marketState === "unconfigured" ? "SETUP" : "OFFLINE"}</div><div className="reason">{message}</div></div>
    </section>

    <section className="panel history" style={{ marginTop: 18 }}>
      <div className="eyebrow">Audit trail</div><h2>Decision history</h2>
      {decided.length === 0 && state.transactions.length === 0 ? <div className="empty">No decisions yet.</div> : <>
        {decided.slice().reverse().map(r => <div className="history-row" key={r.id}><span className={`action ${r.action.toLowerCase()}`}>{r.status}</span><strong>{r.ticker}</strong><span>{r.action} {money(r.amount)}</span><span className="reason">{r.decidedAt ? new Date(r.decidedAt).toLocaleString() : "—"}</span></div>)}
        {state.transactions.slice().reverse().map(t => <div className="history-row" key={t.id}><span className="action hold">RECORDED</span><strong>{t.ticker}</strong><span>{t.side} {sharesText(t.shares)} @ {preciseMoney(t.price)}</span><span className="reason">{new Date(t.createdAt).toLocaleString()}</span></div>)}
      </>}
    </section>

    <div className="footer"><span>MilliPort V4 · M3 Portfolio State &amp; Approval · Decisions are informational and not financial advice.</span><button className="reset" onClick={resetM3}>Reset local M3 state</button></div>
  </main>;
}
