import type { PortfolioRefreshedEvent, PortfolioSnapshot } from "@/lib/portfolio-snapshot";
import { INITIAL_PORTFOLIO_BASELINE_USD } from "@/lib/portfolio-snapshot";

export type PortfolioAnalysis = {
  snapshot_id: string;
  current_value_usd: number;
  previous_value_usd: number;
  change_usd: number;
  change_pct: number;
  target_value_usd: number;
  target_gap_usd: number;
  required_gain_pct: number;
  initial_baseline_usd: number;
  change_since_baseline_usd: number;
  material: boolean;
  alerts: string[];
  data_quality: PortfolioSnapshot["status"];
};

const MATERIAL_POSITION_MOVE_PCT = 5;
const MATERIAL_PORTFOLIO_MOVE_PCT = 5;

export function analyzePortfolioRefresh(
  event: PortfolioRefreshedEvent,
  snapshot: PortfolioSnapshot,
  previous?: PortfolioSnapshot,
): PortfolioAnalysis {
  if (event.snapshot_id !== snapshot.snapshot_id) {
    throw new Error("PORTFOLIO_REFRESHED snapshot_id does not match retrieved snapshot");
  }

  const alerts: string[] = [];
  const portfolioMaterial = Math.abs(snapshot.portfolio.change_pct) >= MATERIAL_PORTFOLIO_MOVE_PCT;
  if (portfolioMaterial) alerts.push(`Portfolio moved ${snapshot.portfolio.change_pct.toFixed(2)}% since the previous snapshot.`);

  for (const position of snapshot.positions) {
    const previousPosition = previous?.positions.find((item) => item.ticker === position.ticker);
    if (!previousPosition || previousPosition.market_value_usd <= 0) continue;
    const positionChangePct = ((position.market_value_usd - previousPosition.market_value_usd) / previousPosition.market_value_usd) * 100;
    if (Math.abs(positionChangePct) >= MATERIAL_POSITION_MOVE_PCT) {
      alerts.push(`${position.ticker} position moved ${positionChangePct.toFixed(2)}% since the previous snapshot; review price move versus thesis change.`);
    }
  }

  return {
    snapshot_id: snapshot.snapshot_id,
    current_value_usd: snapshot.portfolio.total_value_usd,
    previous_value_usd: snapshot.portfolio.previous_value_usd,
    change_usd: snapshot.portfolio.change_usd,
    change_pct: snapshot.portfolio.change_pct,
    target_value_usd: snapshot.target.target_value_usd,
    target_gap_usd: snapshot.target.dollar_gap_usd,
    required_gain_pct: snapshot.target.required_gain_pct,
    initial_baseline_usd: INITIAL_PORTFOLIO_BASELINE_USD,
    change_since_baseline_usd: snapshot.portfolio.total_value_usd - INITIAL_PORTFOLIO_BASELINE_USD,
    material: alerts.length > 0,
    alerts,
    data_quality: snapshot.status,
  };
}
