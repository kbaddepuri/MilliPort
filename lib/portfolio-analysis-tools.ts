import type { PortfolioSnapshot } from "@/lib/portfolio-snapshot";
import { getLatestSnapshotFromDatabase, listSnapshotsFromDatabase } from "@/lib/portfolio-snapshot-db";

export type LatestPortfolioSnapshotToolInput = { portfolio_id?: string };

export type LatestPortfolioSnapshotToolOutput = {
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
  positions: Array<{
    ticker: string;
    company_name: string;
    quantity: number;
    current_price_usd: number;
    market_value_usd: number;
    average_cost_usd: number;
    cost_basis_usd: number;
    unrealized_pnl_usd: number;
    unrealized_pnl_pct: number;
    previous_snapshot_market_value_usd?: number;
    previous_snapshot_price_usd?: number;
    previous_snapshot_quantity?: number;
  }>;
  data_status: {
    portfolio: "fresh" | "stale" | "unavailable" | "not_configured";
    prices: "fresh" | "stale" | "unavailable" | "not_configured";
    timestamp: string;
  };
  target: PortfolioSnapshot["target"];
};

function freshness(status: PortfolioSnapshot["status"]["portfolio_data_status"]): LatestPortfolioSnapshotToolOutput["data_status"]["portfolio"] {
  return status === "success" ? "fresh" : status;
}

export async function get_latest_portfolio_snapshot(
  input: LatestPortfolioSnapshotToolInput = {},
): Promise<LatestPortfolioSnapshotToolOutput> {
  const portfolioId = input.portfolio_id ?? "primary";
  const snapshot = await getLatestSnapshotFromDatabase(portfolioId);
  if (!snapshot) throw new Error("NO_PORTFOLIO_SNAPSHOT");
  return {
    portfolio_id: snapshot.portfolio_id,
    snapshot_id: snapshot.snapshot_id,
    timestamp: snapshot.timestamp,
    portfolio: snapshot.portfolio,
    positions: snapshot.positions.map((position) => ({
      ticker: position.ticker,
      company_name: position.company_name,
      quantity: position.quantity,
      current_price_usd: position.price_usd,
      market_value_usd: position.market_value_usd,
      average_cost_usd: position.average_cost_usd,
      cost_basis_usd: position.total_cost_basis_usd,
      unrealized_pnl_usd: position.unrealized_pnl_usd,
      unrealized_pnl_pct: position.unrealized_pnl_pct,
      previous_snapshot_market_value_usd: position.previous_snapshot_market_value_usd,
      previous_snapshot_price_usd: position.previous_snapshot_price_usd,
      previous_snapshot_quantity: position.previous_snapshot_quantity,
    })),
    data_status: {
      portfolio: freshness(snapshot.status.portfolio_data_status),
      prices: freshness(snapshot.status.market_data_status),
      timestamp: snapshot.status.refreshed_at,
    },
    target: snapshot.target,
  };
}

export type PortfolioSnapshotHistoryToolInput = { portfolio_id?: string; limit?: number };

export async function get_portfolio_snapshot_history(
  input: PortfolioSnapshotHistoryToolInput = {},
): Promise<{ snapshots: Array<{ snapshot_id: string; timestamp: string; total_value_usd: number }> }> {
  const portfolioId = input.portfolio_id ?? "primary";
  const limit = Math.min(Math.max(input.limit ?? 30, 1), 100);
  const snapshots = await listSnapshotsFromDatabase(portfolioId, limit);
  return {
    snapshots: snapshots.map((snapshot) => ({
      snapshot_id: snapshot.snapshot_id,
      timestamp: snapshot.timestamp,
      total_value_usd: snapshot.portfolio.total_value_usd,
    })),
  };
}
