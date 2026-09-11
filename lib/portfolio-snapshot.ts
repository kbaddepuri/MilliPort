import type { Quote } from "@/lib/market-data/types";
import type { PortfolioState } from "@/lib/portfolio-state";
import { portfolio, TARGET_VALUE } from "@/lib/portfolio";

export const PORTFOLIO_ID = "primary";
export const INITIAL_PORTFOLIO_BASELINE_USD = 16469;
export const SNAPSHOT_STORAGE_KEY = "milliport:portfolio-snapshots:v1";

export type SnapshotDataStatus = "success" | "stale" | "unavailable" | "not_configured";

export type PortfolioSnapshotPosition = {
  ticker: string;
  company_name: string;
  quantity: number;
  price_usd: number;
  market_value_usd: number;
  average_cost_usd: number;
  total_cost_basis_usd: number;
  unrealized_pnl_usd: number;
  unrealized_pnl_pct: number;
  allocation_usd: number;
  previous_snapshot_market_value_usd?: number;
  previous_snapshot_price_usd?: number;
  previous_snapshot_quantity?: number;
  previous_snapshot_allocation_usd?: number;
  sector?: string;
  asset_type?: string;
  exchange?: string;
  currency: string;
};

export type PortfolioSnapshot = {
  portfolio_id: string;
  snapshot_id: string;
  timestamp: string;
  portfolio: {
    total_value_usd: number;
    cash_usd: number;
    invested_value_usd: number;
    previous_value_usd: number;
    change_usd: number;
    change_pct: number;
  };
  positions: PortfolioSnapshotPosition[];
  status: {
    market_data_status: SnapshotDataStatus;
    portfolio_data_status: SnapshotDataStatus;
    fundamental_data_status: SnapshotDataStatus;
    news_data_status: SnapshotDataStatus;
    refreshed_at: string;
  };
  target: {
    target_value_usd: number;
    dollar_gap_usd: number;
    required_gain_pct: number;
    initial_baseline_usd: number;
    change_since_baseline_usd: number;
  };
};

export type PortfolioRefreshedEvent = {
  event: "PORTFOLIO_REFRESHED";
  portfolio_id: string;
  snapshot_id: string;
  portfolio_value_usd: number;
  previous_portfolio_value_usd: number;
  change_usd: number;
  change_pct: number;
  positions_changed: boolean;
  market_data_refreshed: boolean;
  timestamp: string;
};

export function createSnapshotId(timestamp: string): string {
  const compact = timestamp.replace(/[-:TZ+.]/g, "").slice(0, 14);
  return `snap_${compact}`;
}

export function buildPortfolioSnapshot(
  state: PortfolioState,
  quotes: Record<string, Quote>,
  previous?: PortfolioSnapshot,
): PortfolioSnapshot {
  const timestamp = new Date().toISOString();
  const previousByTicker = new Map((previous?.positions ?? []).map((p) => [p.ticker, p]));
  const quotesComplete = state.positions.every((position) => {
    const quote = quotes[position.ticker];
    return Boolean(quote && quote.price > 0);
  });
  const holdings = state.positions.map((position) => {
    const quote = quotes[position.ticker];
    const known = portfolio.find((h) => h.ticker === position.ticker);
    const price = quote?.price ?? 0;
    const marketValue = position.shares * price;
    const costBasis = position.shares * position.avgCost;
    const pnl = marketValue - costBasis;
    const previousPosition = previousByTicker.get(position.ticker);
    return {
      ticker: position.ticker,
      company_name: known?.name ?? `${position.ticker} position`,
      quantity: position.shares,
      price_usd: price,
      market_value_usd: marketValue,
      average_cost_usd: position.avgCost,
      total_cost_basis_usd: costBasis,
      unrealized_pnl_usd: pnl,
      unrealized_pnl_pct: costBasis > 0 ? (pnl / costBasis) * 100 : 0,
      allocation_usd: marketValue,
      previous_snapshot_market_value_usd: previousPosition?.market_value_usd,
      previous_snapshot_price_usd: previousPosition?.price_usd,
      previous_snapshot_quantity: previousPosition?.quantity,
      previous_snapshot_allocation_usd: previousPosition?.allocation_usd,
      asset_type: "equity",
      currency: quote?.currency ?? "USD",
      exchange: undefined,
      sector: undefined,
    } satisfies PortfolioSnapshotPosition;
  });

  const investedValue = holdings.reduce((sum, position) => sum + position.market_value_usd, 0);
  const totalValue = investedValue + state.cash;
  const previousValue = previous?.portfolio.total_value_usd ?? INITIAL_PORTFOLIO_BASELINE_USD;
  const change = totalValue - previousValue;
  const changePct = previousValue > 0 ? (change / previousValue) * 100 : 0;
  const gap = Math.max(0, TARGET_VALUE - totalValue);

  return {
    portfolio_id: PORTFOLIO_ID,
    snapshot_id: createSnapshotId(timestamp),
    timestamp,
    portfolio: {
      total_value_usd: totalValue,
      cash_usd: state.cash,
      invested_value_usd: investedValue,
      previous_value_usd: previousValue,
      change_usd: change,
      change_pct: changePct,
    },
    positions: holdings,
    status: {
      market_data_status: quotesComplete ? "success" : "stale",
      portfolio_data_status: "success",
      fundamental_data_status: "not_configured",
      news_data_status: "not_configured",
      refreshed_at: timestamp,
    },
    target: {
      target_value_usd: TARGET_VALUE,
      dollar_gap_usd: gap,
      required_gain_pct: totalValue > 0 ? (gap / totalValue) * 100 : 0,
      initial_baseline_usd: INITIAL_PORTFOLIO_BASELINE_USD,
      change_since_baseline_usd: totalValue - INITIAL_PORTFOLIO_BASELINE_USD,
    },
  };
}

export function snapshotEvent(snapshot: PortfolioSnapshot): PortfolioRefreshedEvent {
  const positionsChanged = snapshot.positions.some((position) =>
    position.previous_snapshot_market_value_usd !== undefined &&
    Math.abs(position.market_value_usd - position.previous_snapshot_market_value_usd) > 0.005,
  );
  return {
    event: "PORTFOLIO_REFRESHED",
    portfolio_id: snapshot.portfolio_id,
    snapshot_id: snapshot.snapshot_id,
    portfolio_value_usd: snapshot.portfolio.total_value_usd,
    previous_portfolio_value_usd: snapshot.portfolio.previous_value_usd,
    change_usd: snapshot.portfolio.change_usd,
    change_pct: snapshot.portfolio.change_pct,
    positions_changed: positionsChanged,
    market_data_refreshed: snapshot.status.market_data_status === "success",
    timestamp: snapshot.timestamp,
  };
}

export function readLocalSnapshots(): PortfolioSnapshot[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(SNAPSHOT_STORAGE_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed as PortfolioSnapshot[] : [];
  } catch {
    return [];
  }
}

export function persistLocalSnapshot(snapshot: PortfolioSnapshot): void {
  if (typeof window === "undefined") return;
  const snapshots = readLocalSnapshots().filter((item) => item.snapshot_id !== snapshot.snapshot_id);
  window.localStorage.setItem(SNAPSHOT_STORAGE_KEY, JSON.stringify([snapshot, ...snapshots].slice(0, 100)));
}
