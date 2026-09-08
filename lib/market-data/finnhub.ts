import type { MarketDataProvider, MarketDataResult, Quote } from "./types";

const BASE_URL = "https://finnhub.io/api/v1";

export class FinnhubProvider implements MarketDataProvider {
  constructor(private readonly apiKey: string) {}

  async getQuotes(tickers: string[]): Promise<MarketDataResult> {
    const quotes = await Promise.all(tickers.map((ticker) => this.getQuote(ticker)));
    return {
      quotes: quotes.filter((quote): quote is Quote => quote !== null),
      provider: "finnhub",
      fetchedAt: new Date().toISOString(),
    };
  }

  private async getQuote(ticker: string): Promise<Quote | null> {
    const url = `${BASE_URL}/quote?symbol=${encodeURIComponent(ticker)}&token=${encodeURIComponent(this.apiKey)}`;
    const response = await fetch(url, { next: { revalidate: 30 } });
    if (!response.ok) throw new Error(`Finnhub request failed for ${ticker}: ${response.status}`);

    const data = (await response.json()) as { c?: number; d?: number; dp?: number; t?: number };
    if (!data.c || !data.t) return null;

    return {
      ticker,
      price: data.c,
      change: data.d ?? 0,
      changePercent: data.dp ?? 0,
      currency: "USD",
      asOf: new Date(data.t * 1000).toISOString(),
    };
  }
}

export function createMarketDataProvider(): MarketDataProvider | null {
  const apiKey = process.env.FINNHUB_API_KEY;
  return apiKey ? new FinnhubProvider(apiKey) : null;
}
