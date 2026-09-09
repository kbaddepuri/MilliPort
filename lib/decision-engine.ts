import type { Quote } from "@/lib/market-data/types";
import type { Action, PortfolioState } from "@/lib/portfolio-state";

export type Candidate = {
  ticker: string;
  name: string;
  category: string;
  growth: number;
  quality: number;
  catalyst: number;
  strategicFit: number;
  asymmetry: number;
  risk: number;
  maxPositionPct: number;
  enabled: boolean;
  thesis: string;
};

export type AgentPick = {
  ticker: string;
  name: string;
  score: number;
  action: Action;
  amount: number;
  price?: number;
  shares?: number;
  currentValue: number;
  rationale: string;
  thesis: string;
  rank: number;
};

// M4 is deterministic: the engine can only choose from this explicit strategy universe.
// A future market-scanner adapter can replace/extend this list without changing the scoring logic.
export const strategyUniverse: Candidate[] = [
  { ticker: "NVDA", name: "NVIDIA", category: "AI compute", growth: 100, quality: 98, catalyst: 96, strategicFit: 100, asymmetry: 82, risk: 38, maxPositionPct: 24, enabled: true, thesis: "Core AI compute leader with exceptional data-center demand." },
  { ticker: "SKHY", name: "SK Hynix", category: "AI memory", growth: 98, quality: 94, catalyst: 97, strategicFit: 98, asymmetry: 87, risk: 42, maxPositionPct: 20, enabled: true, thesis: "HBM leadership gives direct exposure to the AI memory bottleneck." },
  { ticker: "POWL", name: "Powell Industries", category: "Data-center power", growth: 92, quality: 91, catalyst: 94, strategicFit: 97, asymmetry: 91, risk: 40, maxPositionPct: 18, enabled: true, thesis: "Power infrastructure is a critical constraint as AI data centers scale." },
  { ticker: "QCOM", name: "Qualcomm", category: "AI inference + connectivity", growth: 88, quality: 91, catalyst: 96, strategicFit: 94, asymmetry: 90, risk: 40, maxPositionPct: 12, enabled: true, thesis: "Custom AI inference and data-center connectivity create a new growth leg." },
  { ticker: "CRDO", name: "Credo Technology", category: "Optical connectivity", growth: 99, quality: 89, catalyst: 93, strategicFit: 98, asymmetry: 91, risk: 55, maxPositionPct: 10, enabled: true, thesis: "Very strong AI connectivity growth, but recent volatility raises entry risk." },
  { ticker: "POET", name: "POET Technologies", category: "Optical interconnect", growth: 96, quality: 67, catalyst: 96, strategicFit: 99, asymmetry: 99, risk: 78, maxPositionPct: 9, enabled: true, thesis: "High-risk optical platform with potentially asymmetric AI interconnect upside." },
  { ticker: "SNDK", name: "SanDisk", category: "AI storage", growth: 95, quality: 83, catalyst: 91, strategicFit: 91, asymmetry: 86, risk: 58, maxPositionPct: 12, enabled: true, thesis: "AI storage demand is attractive, but the large rally argues against chasing." },
  { ticker: "SPCX", name: "SpaceX", category: "Space + communications", growth: 97, quality: 82, catalyst: 92, strategicFit: 76, asymmetry: 89, risk: 72, maxPositionPct: 12, enabled: true, thesis: "Strategic long-duration growth asset with substantial execution and valuation risk." },
  { ticker: "SMCI", name: "Super Micro Computer", category: "AI servers", growth: 94, quality: 70, catalyst: 84, strategicFit: 91, asymmetry: 88, risk: 68, maxPositionPct: 10, enabled: true, thesis: "AI server demand is strong, but financing and cash-flow risks require patience." },
  { ticker: "APH", name: "Amphenol", category: "AI connectivity", growth: 89, quality: 96, catalyst: 86, strategicFit: 70, asymmetry: 72, risk: 28, maxPositionPct: 12, enabled: true, thesis: "Excellent connectivity business, but lower upside asymmetry than the top growth ideas for this mission." },
  { ticker: "HUBB", name: "Hubbell", category: "Power infrastructure", growth: 82, quality: 94, catalyst: 82, strategicFit: 66, asymmetry: 67, risk: 30, maxPositionPct: 12, enabled: true, thesis: "High-quality electrification exposure with less upside asymmetry for this mission." },
  { ticker: "GOOG", name: "Alphabet", category: "AI platform", growth: 84, quality: 98, catalyst: 82, strategicFit: 55, asymmetry: 66, risk: 25, maxPositionPct: 12, enabled: true, thesis: "Excellent company, but broad mega-cap exposure is less aligned with the aggressive $30K mission." },
  { ticker: "VERA", name: "Vera Therapeutics", category: "Biotech", growth: 90, quality: 61, catalyst: 92, strategicFit: 48, asymmetry: 92, risk: 88, maxPositionPct: 5, enabled: true, thesis: "Commercial launch creates upside, but clinical, cash-burn and execution risks are high." },
  { ticker: "ARM", name: "Arm Holdings", category: "AI compute IP", growth: 91, quality: 92, catalyst: 88, strategicFit: 90, asymmetry: 78, risk: 52, maxPositionPct: 10, enabled: true, thesis: "AI compute architecture exposure with strong secular growth, balanced by valuation risk." },
  { ticker: "GLW", name: "Corning", category: "Optical infrastructure", growth: 84, quality: 88, catalyst: 94, strategicFit: 94, asymmetry: 81, risk: 43, maxPositionPct: 10, enabled: true, thesis: "Optical fiber demand is benefiting from AI networking and data-center buildout." },
  { ticker: "SITM", name: "SiTime", category: "Timing infrastructure", growth: 90, quality: 84, catalyst: 87, strategicFit: 89, asymmetry: 83, risk: 62, maxPositionPct: 8, enabled: true, thesis: "Timing components can benefit from higher-speed AI and networking architectures." },
];

const roundDollar = (n: number) => Math.floor(Math.max(0, n) / 50) * 50;

export function scoreCandidate(candidate: Candidate): number {
  if (!candidate.enabled) return 0;
  const raw =
    candidate.growth * 0.25 +
    candidate.quality * 0.15 +
    candidate.catalyst * 0.20 +
    candidate.strategicFit * 0.20 +
    candidate.asymmetry * 0.20 -
    candidate.risk * 0.10;
  return Math.max(0, Math.min(100, Math.round(raw)));
}

function positionValue(state: PortfolioState, ticker: string, quotes: Record<string, Quote>): number {
  const position = state.positions.find((p) => p.ticker === ticker);
  return position && quotes[ticker] ? position.shares * quotes[ticker].price : 0;
}

export function runDecisionEngine(
  state: PortfolioState,
  quotes: Record<string, Quote>,
): AgentPick[] {
  const portfolioValue = state.cash + strategyUniverse.reduce((sum, candidate) => sum + positionValue(state, candidate.ticker, quotes), 0);
  if (portfolioValue <= 0) return [];

  const evaluated = strategyUniverse
    .filter((candidate) => candidate.enabled)
    .map((candidate) => {
      const price = quotes[candidate.ticker]?.price;
      const currentValue = positionValue(state, candidate.ticker, quotes);
      const score = scoreCandidate(candidate);
      const currentPct = currentValue / portfolioValue * 100;
      return { candidate, price, currentValue, score, currentPct };
    });

  // First identify capital that the strategy wants to rotate out of lower-conviction holdings.
  const trims = evaluated
    .filter(({ currentValue, score, currentPct }) => currentValue > 0 && score < 78 && currentPct > 4)
    .sort((a, b) => a.score - b.score)
    .map(({ candidate, currentValue, score, price, currentPct }) => {
      const amount = roundDollar(Math.min(600, currentValue * 0.35));
      return {
        ticker: candidate.ticker,
        name: candidate.name,
        score,
        action: amount > 0 ? "SELL" as const : "HOLD" as const,
        amount,
        price,
        shares: price && amount > 0 ? amount / price : undefined,
        currentValue,
        rationale: `${score}/100 strategy score · ${currentPct.toFixed(1)}% portfolio · rotate capital toward higher-conviction growth`,
        thesis: candidate.thesis,
        rank: 0,
      };
    });

  const reallocationBudget = state.cash + trims.reduce((sum, trim) => sum + trim.amount, 0);
  let remainingBudget = reallocationBudget;

  const buys = evaluated
    .filter(({ score, currentPct, candidate }) => score >= 88 && currentPct < candidate.maxPositionPct && candidate.ticker !== "CRDO")
    .sort((a, b) => b.score - a.score)
    .map(({ candidate, price, currentValue, score, currentPct }) => {
      const capRoom = portfolioValue * candidate.maxPositionPct / 100 - currentValue;
      const baseAllocation = score >= 95 ? 600 : score >= 91 ? 500 : 400;
      const amount = roundDollar(Math.min(baseAllocation, capRoom, remainingBudget));
      remainingBudget -= amount;
      const action: Action = amount > 0 ? "BUY" : "HOLD";
      return {
        ticker: candidate.ticker,
        name: candidate.name,
        score,
        action,
        amount,
        price,
        shares: price && amount > 0 ? amount / price : undefined,
        currentValue,
        rationale: `${score}/100 strategy score · ${currentPct.toFixed(1)}% portfolio · ${candidate.category}`,
        thesis: candidate.thesis,
        rank: 0,
      };
    });

  // Deliberate risk controls from the current strategy: no fresh CRDO chase after its sharp move,
  // no additional SNDK/SPCX chase, and VERA stays watch-only until execution risk improves.
  const controls = new Map<string, Partial<AgentPick>>([
    ["CRDO", { action: "WATCH", amount: 0, rationale: "High score, but recent volatility makes this a watchlist entry rather than a chase." }],
    ["SNDK", { action: "HOLD", amount: 0, rationale: "Strong AI-storage thesis, but the position has already rallied sharply." }],
    ["SPCX", { action: "HOLD", amount: 0, rationale: "Meaningful existing position; wait for better capital-allocation room." }],
    ["VERA", { action: "WATCH", amount: 0, rationale: "High-risk biotech position remains catalyst-driven and execution-sensitive." }],
  ]);

  const all = evaluated.map(({ candidate, price, currentValue, score, currentPct }) => {
    const trim = trims.find((item) => item.ticker === candidate.ticker);
    const buy = buys.find((item) => item.ticker === candidate.ticker);
    const control = controls.get(candidate.ticker);
    if (control) return { ticker: candidate.ticker, name: candidate.name, score, action: control.action ?? "WATCH", amount: control.amount ?? 0, price, shares: control.amount && price ? control.amount / price : undefined, currentValue, rationale: control.rationale ?? `${score}/100 strategy score`, thesis: candidate.thesis, rank: 0 };
    if (trim) return trim;
    if (buy) return buy;
    return { ticker: candidate.ticker, name: candidate.name, score, action: score >= 78 ? "HOLD" as const : "WATCH" as const, amount: 0, price, shares: undefined, currentValue, rationale: `${score}/100 strategy score · ${currentPct.toFixed(1)}% portfolio · no capital move required`, thesis: candidate.thesis, rank: 0 };
  });

  return all
    .sort((a, b) => b.score - a.score || (b.amount - a.amount) || a.ticker.localeCompare(b.ticker))
    .map((pick, index) => ({ ...pick, rank: index + 1 }));
}

export function topActionablePicks(picks: AgentPick[], limit = 6): AgentPick[] {
  return picks.filter((pick) => pick.action === "BUY" || pick.action === "SELL").slice(0, limit);
}
