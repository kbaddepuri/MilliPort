"use client";

import { useEffect, useMemo, useState } from "react";
import { actionBudget, portfolio, START_VALUE, TARGET_VALUE, TOTAL_PNL } from "@/lib/portfolio";
import type { Quote } from "@/lib/market-data/types";

const money = (n:number) => new Intl.NumberFormat("en-US", { style:"currency", currency:"USD", maximumFractionDigits:0 }).format(n);
const preciseMoney = (n:number) => new Intl.NumberFormat("en-US", { style:"currency", currency:"USD", maximumFractionDigits:2 }).format(n);

export default function Home() {
  const [quotes, setQuotes] = useState<Record<string, Quote>>({});
  const [marketState, setMarketState] = useState<"loading" | "live" | "unconfigured" | "error">("loading");
  const [message, setMessage] = useState("");

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

  const liveValue = useMemo(() => portfolio.reduce((sum, holding) => {
    const quote = quotes[holding.ticker];
    return sum + (quote ? quote.price * (holding.value / Math.max(quote.price, 0)) : holding.value);
  }, 0), [quotes]);
  const displayValue = Object.keys(quotes).length ? liveValue : START_VALUE;
  const progress = Math.min(100, displayValue / TARGET_VALUE * 100);
  const gap = Math.max(0, TARGET_VALUE - displayValue);
  const buys = portfolio.filter(h => h.action === "BUY");
  const sells = portfolio.filter(h => h.action === "SELL");

  return <main className="shell">
    <header className="topbar"><div className="brand">Milli<span>Port</span></div><div className="badge">V4 · M2 LIVE DATA</div></header>

    <section className="hero">
      <div className="panel"><div className="eyebrow">Portfolio Growth Engine</div><h1>Build toward <span className="positive">$30K.</span></h1><p>MilliPort now has a provider-backed market-data layer. Quotes are normalized behind an adapter so the portfolio engine is independent of the external data vendor.</p></div>
      <div className="panel target"><div className="eyebrow">Mission progress</div><div className="value">{money(displayValue)}</div><div className="muted">of {money(TARGET_VALUE)}</div><div className="progress"><i style={{width:`${progress}%`}} /></div><div className="muted">{progress.toFixed(1)}% · {money(gap)} remaining</div></div>
    </section>

    <section className="grid">
      <div className="panel metric"><div className="label">Portfolio value</div><div className="number">{money(displayValue)}</div><div className="reason">{marketState === "live" ? "Live provider data" : "Snapshot values"}</div></div>
      <div className="panel metric"><div className="label">Unrealized P&amp;L</div><div className="number positive">+{money(TOTAL_PNL)}</div></div>
      <div className="panel metric"><div className="label">BUY capital</div><div className="number">{money(actionBudget)}</div></div>
      <div className="panel metric"><div className="label">Market data</div><div className="number">{marketState === "live" ? "LIVE" : marketState === "unconfigured" ? "SETUP" : "OFFLINE"}</div><div className="reason">{message}</div></div>
    </section>

    <section className="panel"><div className="eyebrow">Decision queue</div><h2>What MilliPort would do today</h2>
      <table className="table"><thead><tr><th>Asset</th><th>Price</th><th>Move</th><th>Action</th><th>Dollar decision</th><th>Thesis</th></tr></thead><tbody>
      {portfolio.map(h => { const q = quotes[h.ticker]; return <tr key={h.ticker}><td><div className="ticker">{h.ticker}</div><div className="reason">{h.name}</div></td><td>{q ? preciseMoney(q.price) : "—"}</td><td className={q && q.changePercent >= 0 ? "positive" : ""}>{q ? `${q.changePercent >= 0 ? "+" : ""}${q.changePercent.toFixed(2)}%` : "—"}</td><td><span className={`action ${h.action.toLowerCase()}`}>{h.action}</span></td><td>{h.actionAmount ? `${h.action === "SELL" ? "SELL" : "BUY"} ${money(h.actionAmount)}` : "—"}</td><td className="reason">{h.thesis}</td></tr>; })}
      </tbody></table>
    </section>

    <section className="grid" style={{marginTop:18}}><div className="panel metric"><div className="label">BUY ideas</div><div className="number">{buys.length}</div><div className="reason">{buys.map(x=>x.ticker).join(" · ")}</div></div><div className="panel metric"><div className="label">SELL ideas</div><div className="number">{sells.length}</div><div className="reason">{sells.map(x=>x.ticker).join(" · ")}</div></div><div className="panel metric"><div className="label">M2 provider</div><div className="number">Finnhub</div><div className="reason">Server-side adapter · 30s cache</div></div><div className="panel metric"><div className="label">Decision contract</div><div className="number">$ only</div><div className="reason">No percentage-only recommendations</div></div></section>
    <div className="footer">MilliPort V4 · M2 Market Data · Live quotes require FINNHUB_API_KEY. Decisions are informational and not financial advice.</div>
  </main>;
}
