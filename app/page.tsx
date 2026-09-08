import { actionBudget, portfolio, START_VALUE, TARGET_VALUE, TOTAL_PNL } from "@/lib/portfolio";

const money = (n:number) => new Intl.NumberFormat("en-US", { style:"currency", currency:"USD", maximumFractionDigits:0 }).format(n);
const progress = Math.min(100, START_VALUE / TARGET_VALUE * 100);
const gap = TARGET_VALUE - START_VALUE;
const buys = portfolio.filter(h => h.action === "BUY");
const sells = portfolio.filter(h => h.action === "SELL");

export default function Home() {
  return <main className="shell">
    <header className="topbar"><div className="brand">Milli<span>Port</span></div><div className="badge">V4 · FOUNDATION</div></header>

    <section className="hero">
      <div className="panel"><div className="eyebrow">Portfolio Growth Engine</div><h1>Build toward <span className="positive">$30K.</span></h1><p>MilliPort turns portfolio data and investment theses into explicit, dollar-sized decisions. This foundation establishes the product model before live market data and automated intelligence are connected.</p></div>
      <div className="panel target"><div className="eyebrow">Mission progress</div><div className="value">{money(START_VALUE)}</div><div className="muted">of {money(TARGET_VALUE)}</div><div className="progress"><i style={{width:`${progress}%`}} /></div><div className="muted">{progress.toFixed(1)}% · {money(gap)} remaining</div></div>
    </section>

    <section className="grid">
      <div className="panel metric"><div className="label">Portfolio value</div><div className="number">{money(START_VALUE)}</div></div>
      <div className="panel metric"><div className="label">Unrealized P&amp;L</div><div className="number positive">+{money(TOTAL_PNL)}</div></div>
      <div className="panel metric"><div className="label">BUY capital</div><div className="number">{money(actionBudget)}</div></div>
      <div className="panel metric"><div className="label">Holdings</div><div className="number">{portfolio.length}</div></div>
    </section>

    <section className="panel"><div className="eyebrow">Decision queue</div><h2>What MilliPort would do today</h2>
      <table className="table"><thead><tr><th>Asset</th><th>Value</th><th>Action</th><th>Dollar decision</th><th>Thesis</th></tr></thead><tbody>
      {portfolio.map(h => <tr key={h.ticker}><td><div className="ticker">{h.ticker}</div><div className="reason">{h.name}</div></td><td>{money(h.value)}</td><td><span className={`action ${h.action.toLowerCase()}`}>{h.action}</span></td><td>{h.actionAmount ? `${h.action === "SELL" ? "SELL" : "BUY"} ${money(h.actionAmount)}` : "—"}</td><td className="reason">{h.thesis}</td></tr>)}
      </tbody></table>
    </section>

    <section className="grid" style={{marginTop:18}}><div className="panel metric"><div className="label">BUY ideas</div><div className="number">{buys.length}</div><div className="reason">{buys.map(x=>x.ticker).join(" · ")}</div></div><div className="panel metric"><div className="label">SELL ideas</div><div className="number">{sells.length}</div><div className="reason">{sells.map(x=>x.ticker).join(" · ")}</div></div><div className="panel metric"><div className="label">Next engine</div><div className="number">Live data</div><div className="reason">Prices, fundamentals, catalysts and risk</div></div><div className="panel metric"><div className="label">Decision contract</div><div className="number">$ only</div><div className="reason">No percentage-only recommendations</div></div></section>
    <div className="footer">MilliPort V4 · Foundation · Decisions are informational and not financial advice.</div>
  </main>;
}
