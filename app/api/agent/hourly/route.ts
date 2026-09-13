import { NextResponse } from "next/server";
import { strategyUniverse } from "@/lib/decision-engine";
import { analyzeAuthoritativePortfolio } from "@/lib/authoritative-portfolio-agent";
import { PORTFOLIO_ID, type PortfolioSnapshot } from "@/lib/portfolio-snapshot";
import { getServerSnapshots, getLatestServerSnapshot } from "@/lib/portfolio-snapshot-server";
import { createMarketDataProvider } from "@/lib/market-data/finnhub";
import type { Quote } from "@/lib/market-data/types";

export const dynamic = "force-dynamic";

const MAX_SNAPSHOT_AGE_MS = 2 * 60 * 60 * 1000;

function unauthorized(request: Request): boolean {
  const expected = process.env.MILLIPORT_AGENT_SECRET;
  if (!expected) return process.env.NODE_ENV === "production";
  return request.headers.get("authorization") !== `Bearer ${expected}`;
}

export async function GET(request: Request) {
  if (unauthorized(request)) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  let latest: PortfolioSnapshot | null;
  let history: PortfolioSnapshot[];
  try {
    // Supabase-backed latest snapshot is the authoritative portfolio state.
    latest = await getLatestServerSnapshot(PORTFOLIO_ID);
    history = await getServerSnapshots(PORTFOLIO_ID, 100);
  } catch (error) {
    return NextResponse.json({ ok: false, error: "SNAPSHOT_STORE_UNAVAILABLE", message: error instanceof Error ? error.message : "Snapshot store unavailable." }, { status: 503 });
  }

  if (!latest) {
    return NextResponse.json({ ok: false, error: "NO_PORTFOLIO_SNAPSHOT", message: "The portfolio analysis agent requires a successful MilliPort portfolio refresh first." }, { status: 409 });
  }

  if (latest.status.market_data_status !== "success" || latest.status.portfolio_data_status !== "success") {
    return NextResponse.json({ ok: false, error: "SNAPSHOT_NOT_ACTIONABLE", snapshot_id: latest.snapshot_id, data_quality: latest.status }, { status: 409 });
  }

  const snapshotAgeMs = Date.now() - new Date(latest.timestamp).getTime();
  if (!Number.isFinite(snapshotAgeMs) || snapshotAgeMs < 0 || snapshotAgeMs > MAX_SNAPSHOT_AGE_MS) {
    return NextResponse.json({ ok: false, error: "SNAPSHOT_STALE", snapshot_id: latest.snapshot_id, timestamp: latest.timestamp, max_age_ms: MAX_SNAPSHOT_AGE_MS }, { status: 409 });
  }

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

  try {
    const analysis = analyzeAuthoritativePortfolio(latest, previous, quotes);
    return NextResponse.json({
      ok: true,
      ...analysis,
      market_data: { provider: marketData.provider, fetched_at: marketData.fetchedAt, quote_count: marketData.quotes.length },
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ ok: false, error: "PORTFOLIO_ANALYSIS_FAILED", snapshot_id: latest.snapshot_id, message: error instanceof Error ? error.message : "Portfolio analysis failed." }, { status: 500 });
  }
}
