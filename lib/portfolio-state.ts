export type Action = "BUY" | "HOLD" | "WATCH" | "SELL" | "EXIT";
export type RecommendationStatus = "PENDING" | "APPROVED" | "REJECTED";

export type Position = {
  ticker: string;
  shares: number;
  avgCost: number;
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

export const STORAGE_KEY = "milliport:m3:portfolio-state";

export const initialRecommendations: Recommendation[] = [
  { id: "rec-aph-sell-550", ticker: "APH", action: "SELL", amount: 550, thesis: "Excellent business, but trim to fund higher-conviction opportunities.", status: "PENDING", createdAt: "2026-09-09T00:00:00.000Z" },
  { id: "rec-hubb-sell-550", ticker: "HUBB", action: "SELL", amount: 550, thesis: "Quality power exposure, but capital can be concentrated elsewhere.", status: "PENDING", createdAt: "2026-09-09T00:00:00.000Z" },
  { id: "rec-goog-sell-600", ticker: "GOOG", action: "SELL", amount: 600, thesis: "Trim broad mega-cap exposure for the current aggressive mission.", status: "PENDING", createdAt: "2026-09-09T00:00:00.000Z" },
  { id: "rec-qcom-buy-500", ticker: "QCOM", action: "BUY", amount: 500, thesis: "Custom AI inference and data-center/optical connectivity opportunity; initiate selectively.", status: "PENDING", createdAt: "2026-09-09T00:00:00.000Z" },
  { id: "rec-poet-buy-400", ticker: "POET", action: "BUY", amount: 400, thesis: "Asymmetric optical-interconnect opportunity; high execution risk. Add selectively up to $400.", status: "PENDING", createdAt: "2026-09-09T00:00:00.000Z" },
];

export const emptyPortfolioState = (): PortfolioState => ({
  cash: 10,
  positions: [],
  transactions: [],
  recommendations: initialRecommendations,
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
