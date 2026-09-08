import { NextResponse } from "next/server";
import { createMarketDataProvider } from "@/lib/market-data/finnhub";
import { portfolio } from "@/lib/portfolio";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const provider = createMarketDataProvider();
  if (!provider) {
    return NextResponse.json(
      { ok: false, error: "MARKET_DATA_NOT_CONFIGURED", message: "Set FINNHUB_API_KEY to enable live market data." },
      { status: 503 },
    );
  }

  const url = new URL(request.url);
  const requested = url.searchParams.get("symbols");
  const tickers = requested
    ? requested.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean).slice(0, 50)
    : portfolio.map((holding) => holding.ticker);

  if (!tickers.length) {
    return NextResponse.json({ ok: false, error: "NO_SYMBOLS" }, { status: 400 });
  }

  try {
    const result = await provider.getQuotes([...new Set(tickers)]);
    return NextResponse.json({ ok: true, ...result }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Market data error", error);
    return NextResponse.json(
      { ok: false, error: "MARKET_DATA_UNAVAILABLE", message: "The market-data provider could not be reached." },
      { status: 502 },
    );
  }
}
