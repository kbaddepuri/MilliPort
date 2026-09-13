import type { Quote } from "@/lib/market-data/types";
import { runDecisionEngine, topActionablePicks } from "@/lib/decision-engine";
import type { PortfolioState } from "@/lib/portfolio-state";
import { INITIAL_PORTFOLIO_BASELINE_USD, snapshotEvent, type PortfolioSnapshot } from "@/lib/portfolio-snapshot";
import { analyzePortfolioRefresh } from "@/lib/portfolio-analysis-agent";

export type HoldingAnalysis = {
  ticker: string;
  company_name: string;
  snapshot_value_usd: number;
  snapshot_price_usd: number;
  quantity: number;
  allocation_usd: number;
  allocation_pct: number;
  unrealized_pnl_usd: number;
  unrealized_pnl_pct: number;
  change_since_previous_usd: number;
  change_since_previous_pct: number;
};

export type AuthoritativePortfolioAnalysis = {
  agent: "authoritative-portfolio-analysis";
  source_of_truth: {
    portfolio_id: string;
    snapshot_id: string;
    timestamp: string;
  };
  previous_snapshot_id: string | null;
  portfolio: PortfolioSnapshot["portfolio"];
  target: PortfolioSnapshot["target"];
  holding_analysis: HoldingAnalysis[];
  material_changes: string[];
  recommendations: ReturnType<typeof topActionablePicks>;
  full_rankings: ReturnType<typeof runDecisionEngine>;
  data_quality: PortfolioSnapshot["status"];
  policy: {
    human_approval_required: true;
    auto_approval: false;
    broker_execution: false;
  };
};

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

export function analyzeAuthoritativePortfolio(
  latest: PortfolioSnapshot,
  previous: PortfolioSnapshot | undefined,
  quotes: Record<string, Quote>,
): AuthoritativePortfolioAnalysis {
  if (previous && new Date(previous.timestamp).getTime() > new Date(latest.timestamp).getTime()) {
    throw new Error("INVALID_SNAPSHOT_ORDER");
  }

  const event = snapshotEvent(latest);
  const changeAnalysis = analyzePortfolioRefresh(event, latest, previous);
  const portfolioValue = latest.portfolio.total_value_usd;

  const holdingAnalysis = latest.positions.map((position) => {
    const previousPosition = previous?.positions.find((item) => item.ticker === position.ticker);
    const previousValue = previousPosition?.market_value_usd ?? position.market_value_usd;
    const change = position.market_value_usd - previousValue;
    return {
      ticker: position.ticker,
      company_name: position.company_name,
      snapshot_value_usd: position.market_value_usd,
      snapshot_price_usd: position.price_usd,
      quantity: position.quantity,
      allocation_usd: position.market_value_usd,
      allocation_pct: portfolioValue > 0 ? (position.market_value_usd / portfolioValue) * 100 : 0,
      unrealized_pnl_usd: position.unrealized_pnl_usd,
      unrealized_pnl_pct: position.unrealized_pnl_pct,
      change_since_previous_usd: change,
      change_since_previous_pct: previousValue > 0 ? (change / previousValue) * 100 : 0,
    };
  });

  const state = stateFromSnapshot(latest);
  const picks = runDecisionEngine(state, quotes);
  const recommendations = topActionablePicks(picks, 6).filter(
    (pick) => pick.action === "BUY" || pick.action === "SELL",
  );

  const materialChanges = [...changeAnalysis.alerts];
  if (latest.portfolio.total_value_usd !== INITIAL_PORTFOLIO_BASELINE_USD) {
    materialChanges.push(
      `Portfolio is $${latest.portfolio.total_value_usd.toFixed(2)} versus the $${INITIAL_PORTFOLIO_BASELINE_USD.toFixed(0)} initial baseline.`,
    );
  }

  return {
    agent: "authoritative-portfolio-analysis",
    source_of_truth: {
      portfolio_id: latest.portfolio_id,
      snapshot_id: latest.snapshot_id,
      timestamp: latest.timestamp,
    },
    previous_snapshot_id: previous?.snapshot_id ?? null,
    portfolio: latest.portfolio,
    target: latest.target,
    holding_analysis: holdingAnalysis,
    material_changes: materialChanges,
    recommendations,
    full_rankings: picks,
    data_quality: latest.status,
    policy: {
      human_approval_required: true,
      auto_approval: false,
      broker_execution: false,
    },
  };
}
