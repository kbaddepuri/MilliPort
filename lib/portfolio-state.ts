export type Action = "BUY" | "HOLD" | "WATCH" | "SELL" | "EXIT";
export type RecommendationStatus = "PENDING" | "APPROVED" | "REJECTED";
export type ShareSource = "DERIVED" | "MANUAL";

export type Position = {
  ticker: string;
  shares: number;
  avgCost: number;
  source: ShareSource;
};

export type Transaction = {
  id: string;
  ticker: string;
  side: "BUY" | "SELL";
  shares: number;
  price: number;
  amount: number;
  createdAt: string;
  source: "AGENT" | "MANUAL";
};

export type Recommendation = {
  id: string;
  ticker: string;
  action: Action;
  amount: number;
  thesis: string;
  status: RecommendationStatus;
  createdAt: string;
  decidedAt?: string;
};

export type PortfolioState = {
  cash: number;
  positions: Position[];
  transactions: Transaction[];
  recommendations: Recommendation[];
};

// M4 uses the actual broker quantities supplied by the user as the portfolio source of truth.
// Bump the storage key so old estimated-share state cannot override the exact imported positions.
export const STORAGE_KEY = "milliport:m4:portfolio-state";

export const initialRecommendations: Recommendation[] = [
  { id: "rec-aph-sell-550", ticker: "APH", action: "SELL", amount: 550, thesis: "Excellent business, but trim to fund higher-conviction opportunities.", status: "PENDING", createdAt: "2026-09-09T00:00:00.000Z" },
  { id: "rec-hubb-sell-550", ticker: "HUBB", action: "SELL", amount: 550, thesis: "Quality power exposure, but capital can be concentrated elsewhere.", status: "PENDING", createdAt: "2026-09-09T00:00:00.000Z" },
  { id: "rec-goog-sell-600", ticker: "GOOG", action: "SELL", amount: 600, thesis: "Trim broad mega-cap exposure for the current aggressive mission.", status: "PENDING", createdAt: "2026-09-09T00:00:00.000Z" },
  { id: "rec-qcom-buy-500", ticker: "QCOM", action: "BUY", amount: 500, thesis: "Custom AI inference and data-center/optical connectivity opportunity; initiate selectively.", status: "PENDING", createdAt: "2026-09-09T00:00:00.000Z" },
  { id: "rec-poet-buy-400", ticker: "POET", action: "BUY", amount: 400, thesis: "Asymmetric optical-interconnect opportunity; high execution risk. Add selectively up to $400.", status: "PENDING", createdAt: "2026-09-09T00:00:00.000Z" },
];

// Exact broker snapshot supplied by the user on 2026-09-09.
// Market values, cost basis, and P&L are derived from these quantities plus live prices.
export const initialPositions: Position[] = [
  { ticker: "APH", shares: 20, avgCost: 79.00, source: "DERIVED" },
  { ticker: "GOOG", shares: 3.9, avgCost: 369.230769, source: "DERIVED" },
  { ticker: "HUBB", shares: 3.3333, avgCost: 450.004500, source: "DERIVED" },
  { ticker: "NVDA", shares: 15.015, avgCost: 175.158175, source: "DERIVED" },
  { ticker: "POET", shares: 100, avgCost: 7.19, source: "DERIVED" },
  { ticker: "POWL", shares: 10, avgCost: 171.00, source: "DERIVED" },
  { ticker: "SKHY", shares: 13, avgCost: 160.769231, source: "DERIVED" },
  { ticker: "SMCI", shares: 20, avgCost: 36.65, source: "DERIVED" },
  { ticker: "SNDK", shares: 0.4057, avgCost: 1782.105004, source: "DERIVED" },
  { ticker: "SPCX", shares: 10.2, avgCost: 173.529412, source: "DERIVED" },
  { ticker: "VERA", shares: 10, avgCost: 38.30, source: "DERIVED" },
];

export const emptyPortfolioState = (): PortfolioState => ({
  cash: 10,
  positions: initialPositions.map(position => ({ ...position })),
  transactions: [],
  recommendations: initialRecommendations.map(recommendation => ({ ...recommendation })),
});

export function positionFor(state: PortfolioState, ticker: string): Position | undefined {
  return state.positions.find((p) => p.ticker === ticker);
}

export function upsertPosition(state: PortfolioState, next: Position): PortfolioState {
  const positions = state.positions.some((p) => p.ticker === next.ticker)
    ? state.positions.map((p) => (p.ticker === next.ticker ? next : p))
    : [...state.positions, next];
  return { ...state, positions };
}
