"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { portfolio, TARGET_VALUE, TOTAL_PNL } from "@/lib/portfolio";
import type { Quote } from "@/lib/market-data/types";
import { runDecisionEngine, topActionablePicks, strategyUniverse } from "@/lib/decision-engine";
import { emptyPortfolioState, positionFor, STORAGE_KEY, upsertPosition, type PortfolioState, type Recommendation } from "@/lib/portfolio-state";
import { analyzePortfolioRefresh } from "@/lib/portfolio-analysis-agent";
import { buildPortfolioSnapshot, persistLocalSnapshot, readLocalSnapshots, snapshotEvent, PORTFOLIO_ID } from "@/lib/portfolio-snapshot";

const money = (n:number) => new Intl.NumberFormat("en-US", {style:"currency",currency:"USD",maximumFractionDigits:0}).format(n);
const preciseMoney = (n:number) => new Intl.NumberFormat("en-US", {style:"currency",currency:"USD",maximumFractionDigits:2}).format(n);
const sharesText = (n:number) => n.toLocaleString("en-US", {maximumFractionDigits:6});
const QUOTE_REFRESH_MS = 30_000;
const QUOTE_REFRESH_SECONDS = QUOTE_REFRESH_MS / 1000;

type HoldingView = {ticker:string;name:string;snapshotValue:number;action:"BUY"|"HOLD"|"WATCH"|"SELL"|"EXIT";actionAmount:number;thesis:string};

async function emitPortfolioSnapshot(state: PortfolioState, quotes: Record<string,Quote>) {
  const previous = readLocalSnapshots()[0];
  const createdSnapshot = buildPortfolioSnapshot(state, quotes, previous);
  const createdEvent = snapshotEvent(createdSnapshot);
  try {
    const response = await fetch(`/api/portfolio/${PORTFOLIO_ID}/snapshots`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(createdSnapshot),
      keepalive: true,
    });
    if (!response.ok) throw new Error("SNAPSHOT_PERSIST_FAILED");
  } catch {
    throw new Error("PORTFOLIO_SNAPSHOT_UNAVAILABLE");
  }
  const event = snapshotEvent(createdSnapshot);
  const analysis = analyzePortfolioRefresh(event, createdSnapshot, previous);
  persistLocalSnapshot(createdSnapshot);
  window.dispatchEvent(new CustomEvent("PORTFOLIO_REFRESHED", { detail: { event, snapshot: createdSnapshot, analysis } }));
  return { snapshot: createdSnapshot, analysis, createdEvent };
}

export default function Home() {
  const [quotes,setQuotes] = useState<Record<string,Quote>>({});
  const [marketState,setMarketState] = useState<"loading"|"live"|"unconfigured"|"error">("loading");
  const [message,setMessage] = useState("");
  const [state,setState] = useState<PortfolioState>(() => emptyPortfolioState());
  const stateRef = useRef<PortfolioState>(state);
  const [hydrated,setHydrated] = useState(false);
  const [notice,setNotice] = useState("");
  const [refreshCountdown,setRefreshCountdown] = useState(QUOTE_REFRESH_SECONDS);
  const [isRefreshing,setIsRefreshing] = useState(false);
  const [refreshNonce,setRefreshNonce] = useState(0);

  useEffect(() => { stateRef.current = state; }, [state]);
  useEffect(() => { try { const saved = window.localStorage.getItem(STORAGE_KEY); if(saved) setState(JSON.parse(saved) as PortfolioState); } catch { setNotice("Saved portfolio state could not be read; using a fresh M4 state."); } finally { setHydrated(true); } }, []);
  useEffect(() => { if(hydrated) window.localStorage.setItem(STORAGE_KEY,JSON.stringify(state)); },[state,hydrated]);

  useEffect(() => {
    let cancelled=false, refreshInProgress=false;
    const refreshQuotes=async()=>{
      if(refreshInProgress) return; refreshInProgress=true; setIsRefreshing(true);
      const currentState = stateRef.current;
      const symbols=Array.from(new Set([...strategyUniverse.map(c=>c.ticker),...portfolio.map(h=>h.ticker),...currentState.positions.map(p=>p.ticker),...currentState.recommendations.filter(r=>r.status==="PENDING").map(r=>r.ticker)]));
      try { const response=await fetch(`/api/quotes?symbols=${encodeURIComponent(symbols.join(","))}`,{cache:"no-store"}); const data=await response.json(); if(cancelled)return;
        if(!response.ok){setMarketState(data.error==="MARKET_DATA_NOT_CONFIGURED"?"unconfigured":"error");setMessage(data.message??"Market data unavailable; no new portfolio snapshot was created.");return;}
        const nextQuotes=Object.fromEntries((data.quotes as Quote[]).map(q=>[q.ticker,q]));
        setQuotes(nextQuotes);setMarketState("live");
        const result = await emitPortfolioSnapshot(stateRef.current, nextQuotes);
        const alertText = result.analysis.alerts.length > 0 ? ` Agent alert: ${result.analysis.alerts.join(" ")}` : " Agent: no material portfolio action detected.";
        setMessage(`Updated ${new Date(data.fetchedAt).toLocaleTimeString()}. Snapshot ${result.snapshot.snapshot_id} created and consumed by the analysis agent.${alertText}`);
      } catch { if(!cancelled){setMarketState("error");setMessage("Could not persist the portfolio snapshot; no server-authoritative refresh was created.");} }
      finally { if(!cancelled){setIsRefreshing(false);setRefreshCountdown(QUOTE_REFRESH_SECONDS);} refreshInProgress=false; }
    };
    if(hydrated) void refreshQuotes();
    const id=window.setInterval(()=>setRefreshCountdown(current=>{if(current<=1){void refreshQuotes();return QUOTE_REFRESH_SECONDS;}return current-1;}),1000);
    return()=>{cancelled=true;window.clearInterval(id);};
  },[refreshNonce,hydrated]);

  const agentPicks=useMemo(()=>runDecisionEngine(state,quotes),[state,quotes]);
  const actionablePicks=useMemo(()=>topActionablePicks(agentPicks,6),[agentPicks]);
  const pending=state.recommendations.filter(r=>r.status==="PENDING");
  const decided=state.recommendations.filter(r=>r.status!=="PENDING");

  useEffect(() => {
    if(!hydrated || actionablePicks.length===0) return;
    const additions:Recommendation[]=[];
    for(const pick of actionablePicks){
      if((pick.action!=="BUY"&&pick.action!=="SELL")||pick.amount<=0) continue;
      const exists=state.recommendations.some(r=>r.status==="PENDING"&&r.ticker===pick.ticker&&r.action===pick.action);
      if(exists) continue;
      additions.push({id:`agent-${pick.ticker}-${pick.action.toLowerCase()}-${Date.now()}-${additions.length}`,ticker:pick.ticker,action:pick.action,amount:pick.amount,thesis:`${pick.thesis} ${pick.rationale}`,status:"PENDING",createdAt:new Date().toISOString()});
    }
    if(additions.length>0) setState(s=>({...s,recommendations:[...s.recommendations,...additions]}));
  },[actionablePicks,hydrated]);

  function derivedShares(ticker:string,snapshotValue:number){const q=quotes[ticker];return q&&q.price>0?snapshotValue/q.price:undefined;}
  function effectiveShares(ticker:string,snapshotValue:number){const p=positionFor(state,ticker);return p?p.shares:derivedShares(ticker,snapshotValue)??0;}
  const holdingViews=useMemo<HoldingView[]>(()=>{const base=portfolio.map(h=>({ticker:h.ticker,name:h.name,snapshotValue:h.value,action:h.action,actionAmount:h.actionAmount,thesis:h.thesis}));for(const p of state.positions)if(!base.some(h=>h.ticker===p.ticker))base.push({ticker:p.ticker,name:`${p.ticker} position`,snapshotValue:p.shares*(quotes[p.ticker]?.price??0),action:"HOLD",actionAmount:0,thesis:"Approved position; included in portfolio state."});return base;},[state.positions,quotes]);
  const portfolioValue=useMemo(()=>holdingViews.reduce((sum,h)=>{const p=positionFor(state,h.ticker),q=quotes[h.ticker];return sum+(p&&q?p.shares*q.price:h.snapshotValue);},state.cash),[holdingViews,state,quotes]);
  const progress=Math.min(100,portfolioValue/TARGET_VALUE*100), gap=Math.max(0,TARGET_VALUE-portfolioValue), investedValue=portfolioValue-state.cash, approvedCount=state.transactions.length;

  function setManualShares(ticker:string,raw:string){const value=raw.trim(),current=positionFor(state,ticker);if(value===""){if(current?.source==="MANUAL")setState(s=>upsertPosition(s,{...current,source:"DERIVED"}));return;}const shares=Number(value);if(!Number.isFinite(shares)||shares<0)return;setState(s=>upsertPosition(s,{ticker,shares,avgCost:current?.avgCost??0,source:"MANUAL"}));}
  function approveRecommendation(rec:Recommendation){const q=quotes[rec.ticker];if(!q||q.price<=0){setNotice(`Cannot approve ${rec.ticker}: a live price is required.`);return;}const p=positionFor(state,rec.ticker),known=portfolio.find(h=>h.ticker===rec.ticker),available=p?.shares??(known?derivedShares(rec.ticker,known.value):0)??0,shares=rec.amount/q.price;if(rec.action==="SELL"&&(available<=0||shares>available+1e-9)){setNotice(`Cannot approve ${rec.ticker} sale: insufficient known shares.`);return;}if(rec.action==="BUY"&&state.cash<rec.amount){setNotice(`Insufficient recorded cash for ${rec.ticker}. Approve planned sales first.`);return;}const now=new Date().toISOString();let next={...state};if(rec.action==="BUY"){const old=p?.shares??0,cost=p?.avgCost??0;next=upsertPosition(next,{ticker:rec.ticker,shares:old+shares,avgCost:(old*cost+rec.amount)/(old+shares),source:"DERIVED"});next.cash-=rec.amount;}else if(rec.action==="SELL"){next=upsertPosition(next,{ticker:rec.ticker,shares:Math.max(0,available-shares),avgCost:p?.avgCost??0,source:p?.source??"DERIVED"});next.cash+=rec.amount;}next.transactions=[...next.transactions,{id:`txn-${Date.now()}`,ticker:rec.ticker,side:rec.action==="BUY"?"BUY":"SELL",shares,price:q.price,amount:rec.amount,createdAt:now,source:"AGENT"}];next.recommendations=next.recommendations.map(x=>x.id===rec.id?{...x,status:"APPROVED",decidedAt:now}:x);setState(next);setNotice(`${rec.action} ${rec.ticker} for ${money(rec.amount)} approved and recorded. No broker order was placed.`);}
  function rejectRecommendation(rec:Recommendation){const now=new Date().toISOString();setState(s=>({...s,recommendations:s.recommendations.map(x=>x.id===rec.id?{...x,status:"REJECTED",decidedAt:now}:x)}));setNotice(`${rec.ticker} ${rec.action} recommendation rejected.`);}
  function resetM4(){if(!window.confirm("Reset MilliPort M4 local state? This removes recorded transactions, positions, cash changes, and decisions in this browser."))return;setState(emptyPortfolioState());setNotice("M4 local state reset.");}

  return <main className="shell">
    <header className="topbar"><div><div className="brand">Milli<span>Port</span></div><div className="subbrand">Portfolio Decision Engine</div></div><div className="topbar-right"><div className={`refresh-status ${isRefreshing?"refreshing":""}`} aria-live="polite"><span className="refresh-dot">●</span>{isRefreshing?"Refreshing…":marketState==="live"?`LIVE · Refresh in ${refreshCountdown}s`:`Refresh in ${refreshCountdown}s`}<button className="refresh-button" type="button" onClick={()=>setRefreshNonce(v=>v+1)} aria-label="Refresh market data now" title="Refresh market data now">↻</button></div><div className="badge">V4 · M4 AGENT</div></div></header>
    <section className="hero"><div className="panel"><div className="eyebrow">Portfolio Growth Engine</div><h1>Build toward <span className="positive">$30K.</span></h1><p>MilliPort recommends trades in dollars, derives share quantities from live prices, and sends actionable recommendations directly to one human approval queue. Approval changes MilliPort state only; broker execution remains OFF.</p></div><div className="panel target"><div className="eyebrow">Mission progress</div><div className="value">{money(portfolioValue)}</div><div className="muted">of {money(TARGET_VALUE)}</div><div className="progress"><i style={{width:`${progress}%`}}/></div><div className="muted">{progress.toFixed(1)}% · {money(gap)} remaining</div></div></section>
    <section className="grid"><div className="panel metric"><div className="label">Portfolio value</div><div className="number">{money(portfolioValue)}</div><div className="reason">{marketState==="live"?"Live quotes × effective shares + cash":"Snapshot until live quotes are configured"}</div></div><div className="panel metric"><div className="label">Recorded cash</div><div className="number">{money(state.cash)}</div><div className="reason">Updated only by approved transactions</div></div><div className="panel metric"><div className="label">Pending approvals</div><div className="number">{pending.length}</div><div className="reason">Agent recommendations awaiting you</div></div><div className="panel metric"><div className="label">Transactions</div><div className="number">{approvedCount}</div><div className="reason">Approved in MilliPort</div></div></section>
    {(notice||message)&&<div className="notice">{notice||message}</div>}

    <section className="panel"><div className="eyebrow">Human approval gate</div><h2>Approval queue</h2><p className="section-note">This is the <strong>only approval queue</strong>. The M4 strategy engine evaluates {strategyUniverse.length} candidates and automatically places actionable BUY/SELL recommendations here. You decide: <strong>Approve</strong> or <strong>Reject</strong>. Auto-approval and broker execution are OFF.</p>
      {pending.length===0?<div className="empty">No pending recommendations. The portfolio is waiting for the next agent decision.</div>:<div className="approval-list">{pending.map(rec=>{const q=quotes[rec.ticker],p=positionFor(state,rec.ticker),known=portfolio.find(h=>h.ticker===rec.ticker),available=p?.shares??(known&&q?known.value/q.price:undefined);return <div className="approval" key={rec.id}><div><div className="ticker">{rec.ticker}</div><div className="reason">{rec.thesis}</div></div><div className={`action ${rec.action.toLowerCase()}`}>{rec.action} {money(rec.amount)}</div><div className="approval-meta"><span>{q?preciseMoney(q.price):"Price unavailable"}</span>{q&&rec.action!=="HOLD"&&<span>≈ {sharesText(rec.amount/q.price)} shares</span>}{rec.action==="SELL"&&<span>Available: {available!==undefined?sharesText(available):"not available"}</span>}</div><div className="actions"><button className="approve" onClick={()=>approveRecommendation(rec)}>Approve</button><button className="reject" onClick={()=>rejectRecommendation(rec)}>Reject</button></div></div>})}</div>}
    </section>

    <section className="panel" style={{marginTop:18}}><div className="eyebrow">Portfolio state</div><h2>Holdings &amp; share quantities</h2><p className="section-note">AUTO uses MilliPort's known dollar holding and current price. MANUAL lets you enter the exact broker quantity. Manual quantities take precedence.</p><div className="table-wrap"><table className="table"><thead><tr><th>Asset</th><th>Shares</th><th>Price</th><th>Market value</th><th>Avg cost</th><th>Action</th></tr></thead><tbody>{holdingViews.map(h=>{const p=positionFor(state,h.ticker),q=quotes[h.ticker],derived=!p||p.source==="DERIVED"?derivedShares(h.ticker,h.snapshotValue):undefined,shares=effectiveShares(h.ticker,h.snapshotValue),value=q?shares*q.price:h.snapshotValue;return <tr key={h.ticker}><td><div className="ticker">{h.ticker}</div><div className="reason">{h.name}</div></td><td><div className="share-cell"><input className="shares-input" type="number" min="0" step="any" placeholder={derived!==undefined?sharesText(derived):"Auto"} value={p?.source==="MANUAL"?p.shares:""} onChange={e=>setManualShares(h.ticker,e.target.value)}/><span className={`share-source ${p?.source==="MANUAL"?"manual":"derived"}`}>{p?.source==="MANUAL"?"MANUAL":"AUTO"}</span></div>{p?.source==="DERIVED"&&<div className="reason">Approved: {sharesText(p.shares)} shares</div>}</td><td>{q?preciseMoney(q.price):"—"}</td><td>{money(value)}</td><td>{p?.avgCost?preciseMoney(p.avgCost):"—"}</td><td><span className={`action ${h.action.toLowerCase()}`}>{h.action}{h.actionAmount?` ${money(h.actionAmount)}`:""}</span></td></tr>})}</tbody></table></div></section>

    <section className="grid" style={{marginTop:18}}><div className="panel metric"><div className="label">Snapshot P&amp;L</div><div className="number">{money(TOTAL_PNL)}</div><div className="reason">Baseline portfolio snapshot</div></div><div className="panel metric"><div className="label">Invested value</div><div className="number">{money(investedValue)}</div><div className="reason">Portfolio value less recorded cash</div></div><div className="panel metric"><div className="label">Agent candidates</div><div className="number">{strategyUniverse.length}</div><div className="reason">Current controlled M4 universe</div></div><div className="panel metric"><div className="label">Decision mode</div><div className="number">MANUAL</div><div className="reason">Human approval required</div></div></section>

    <section className="panel" style={{marginTop:18}}><div className="eyebrow">Audit trail</div><h2>Recent decisions</h2>{decided.length===0?<div className="empty">No decisions recorded yet.</div>:<div>{[...decided].reverse().slice(0,12).map(rec=><div className="history-row" key={rec.id}><span>{new Date(rec.decidedAt??rec.createdAt).toLocaleString()}</span><strong>{rec.ticker}</strong><span>{rec.action} {money(rec.amount)}</span><span>{rec.status}</span></div>)}</div>}</section>

    <footer className="footer"><span>Human approval ON · Auto-approval OFF · Broker execution OFF · Market-data refresh {QUOTE_REFRESH_SECONDS}s · Snapshot event PORTFOLIO_REFRESHED</span><button className="reset" onClick={resetM4}>Reset M4 local state</button></footer>
  </main>;
}
