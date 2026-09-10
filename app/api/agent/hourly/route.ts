import { NextResponse } from "next/server";
import { runDecisionEngine, topActionablePicks, strategyUniverse } from "@/lib/decision-engine";
import { analyzePortfolioRefresh } from "@/lib/portfolio-analysis-agent";
import { PORTFOLIO_ID, snapshotEvent, type PortfolioSnapshot } from "@/lib/portfolio-snapshot";
import { getServerSnapshots, getLatestServerSnapshot } from "@/app/api/portfolio/[portfolioId]/snapshots/route";
import { createMarketDataProvider } from "@/lib/market-data/finnhub";
import type { PortfolioState } from "@/lib/portfolio-state";
import type { Quote } from "@/lib/market-data/types";

export const dynamic = "force-dynamic";

const MAX_SNAPSHOT_AGE_MS = 2 * 60 * 60 * 1000;

function unauthorized(request: Request): boolean {
  const expected = process.env.MILLIPORT_AGENT_SECRET;
  if (!expected) return process.env.NODE_ENV === "production";
  return request.headers.get("authorization") !== `Bearer ${expected}`;
}

function stateFromSnapshot(snapshot: PortfolioSnapshot): PortfolioState {
  return {
    cash: snapshot.portfolio.cash_usd,
    positions: snapshot.positions.map((position) => ({
      ticker: position.ticker,
      shares: position.quantity,
      avgCost: position.average_cost_usd,
      source: "MANUAL",
    })),
    transactions: [],
    recommendations: [],
  };
}

export async function GET(request: Request) {
  if (unauthorized(request)) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const latest = getLatestServerSnapshot(PORTFOLIO_ID);
  if (!latest) {
    return NextResponse.json({ ok: false, error: "NO_PORTFOLIO_SNAPSHOT", message: "The hourly agent requires a successful MilliPort portfolio refresh first." }, { status: 409 });
  }

  if (latest.status.market_data_status !== "success" || latest.status.portfolio_data_status !== "success") {
    return NextResponse.json({ ok: false, error: "SNAPSHOT_NOT_ACTIONABLE", snapshot_id: latest.snapshot_id, data_quality: latest.status }, { status: 409 });
  }

  const snapshotAgeMs = Date.now() - new Date(latest.timestamp).getTime();
  if (!Number.isFinite(snapshotAgeMs) || snapshotAgeMs < 0 || snapshotAgeMs > MAX_SNAPSHOT_AGE_MS) {
    return NextResponse.json({ ok: false, error: "SNAPSHOT_STALE", snapshot_id: latest.snapshot_id, timestamp: latest.timestamp, max_age_ms: MAX_SNAPSHOT_AGE_MS }, { status: 409 });
  }

  const history = getServerSnapshots(PORTFOLIO_ID);
  const previous = history.find((snapshot) => snapshot.snapshot_id !== latest.snapshot_id);
  const provider = createMarketDataProvider();
  if (!provider) {
    return NextResponse.json({ ok: false, error: "MARKET_DATA_NOT_CONFIGURED", snapshot_id: latest.snapshot_id }, { status: 503 });
  }

  const tickers = strategyUniverse.map((candidate) => candidate.ticker);
  let marketData;
  try {
    marketData = await provider.getQuotes(tickers);
  } catch (error) {
    return NextResponse.json({ ok: false, error: "MARKET_DATA_ERROR", snapshot_id: latest.snapshot_id, message: error instanceof Error ? error.message : "Market data request failed." }, { status: 502 });
  }

  const quotes: Record<string, Quote> = Object.fromEntries(marketData.quotes.map((quote) => [quote.ticker, quote]));
  const state = stateFromSnapshot(latest);
  const event = snapshotEvent(latest);
  const analysis = analyzePortfolioRefresh(event, latest, previous);
  const picks = runDecisionEngine(state, quotes);
  const actionable = topActionablePicks(picks, 6).filter((pick) => pick.action === "BUY" || pick.action === "SELL");

  return NextResponse.json({
    ok: true,
    agent: "hourly-portfolio-analysis",
    source_of_truth: {
      portfolio_id: latest.portfolio_id,
      snapshot_id: latest.snapshot_id,
      timestamp: latest.timestamp,
    },
    previous_snapshot_id: previous?.snapshot_id ?? null,
    analysis,
    recommendations: actionable,
    market_data: { provider: marketData.provider, fetched_at: marketData.fetchedAt, quote_count: marketData.quotes.length },
    policy: { human_approval_required: true, auto_approval: false, broker_execution: false },
  }, { headers: { "Cache-Control": "no-store" } });
}
