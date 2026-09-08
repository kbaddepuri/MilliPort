export type Quote = {
  ticker: string;
  price: number;
  change: number;
  changePercent: number;
  currency: string;
  asOf: string;
};

export type MarketDataResult = {
  quotes: Quote[];
  provider: string;
  fetchedAt: string;
};

export interface MarketDataProvider {
  getQuotes(tickers: string[]): Promise<MarketDataResult>;
}
