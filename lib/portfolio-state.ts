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

// M3 v2 supports automatic share estimates plus an optional exact broker override.
export const STORAGE_KEY = "milliport:m3:v2:portfolio-state";

export const initialRecommendations: Recommendation[] = [
  { id: "rec-aph-sell-550", ticker: "APH", action: "SELL", amount: 550, thesis: "Excellent business, but trim to fund higher-conviction opportunities.", status: "PENDING", createdAt: "2026-09-09T00:00:00.000Z" },
  { id: "rec-hubb-sell-550", ticker: "HUBB", action: "SELL", amount: 550, thesis: "Quality power exposure, but capital can be concentrated elsewhere.", status: "PENDING", createdAt: "2026-09-09T00:00:00.000Z" },
  { id: "rec-goog-sell-600", ticker: "GOOG", action: "SELL", amount: 600, thesis: "Trim broad mega-cap exposure for the current aggressive mission.", status: "PENDING", createdAt: "2026-09-09T00:00:00.000Z" },
  { id: "rec-qcom-buy-500", ticker: "QCOM", action: "BUY", amount: 500, thesis: "Custom AI inference and data-center/optical connectivity opportunity; initiate selectively.", status: "PENDING", createdAt: "2026-09-09T00:00:00.000Z" },
  { id: "rec-poet-buy-400", ticker: "POET", action: "BUY", amount: 400, thesis: "Asymmetric optical-interconnect opportunity; high execution risk. Add selectively up to $400.", status: "PENDING", createdAt: "2026-09-09T00:00:00.000Z" },
];

// Approximate quantities reconstructed from the imported broker snapshot.
// They are intentionally marked DERIVED and can be replaced with exact broker quantities.
export const initialPositions: Position[] = [
  { ticker: "NVDA", shares: 18.82, avgCost: 0, source: "DERIVED" },
  { ticker: "SKHY", shares: 12.13, avgCost: 0, source: "DERIVED" },
  { ticker: "POWL", shares: 6.09, avgCost: 0, source: "DERIVED" },
  { ticker: "APH", shares: 11.03, avgCost: 0, source: "DERIVED" },
  { ticker: "SPCX", shares: 10.23, avgCost: 0, source: "DERIVED" },
  { ticker: "HUBB", shares: 3.11, avgCost: 0, source: "DERIVED" },
  { ticker: "GOOG", shares: 4.49, avgCost: 0, source: "DERIVED" },
  { ticker: "POET", shares: 140.92, avgCost: 0, source: "DERIVED" },
  { ticker: "SMCI", shares: 20.30, avgCost: 0, source: "DERIVED" },
  { ticker: "SNDK", shares: 0.413, avgCost: 0, source: "DERIVED" },
  { ticker: "VERA", shares: 39.22, avgCost: 0, source: "DERIVED" },
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
