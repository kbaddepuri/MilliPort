# M4 — Agent Decision + Opportunity Ranking Engine

## Goal

Move MilliPort from a static recommendation list to a deterministic strategy-driven decision engine.

The engine must never randomly pick a ticker. Every candidate is scored against the current `$16K -> $30K` growth mission and the current portfolio state.

## Decision flow

`Strategy Universe -> Score -> Portfolio Exposure -> Capital Rotation -> Risk Controls -> Dollar Allocation -> Human Approval`

### Score model

The current score is deterministic and weighted as follows:

- Growth: 25%
- Quality: 15%
- Catalyst strength: 20%
- Strategic fit with the current mission: 20%
- Asymmetry: 20%
- Risk penalty: 10%

The result is a 0–100 strategy score.

## Capital allocation

- Existing lower-conviction positions can generate a planned trim budget.
- Higher-conviction candidates can receive dollar-sized BUY recommendations from that budget.
- Position caps prevent the engine from concentrating beyond the candidate's configured maximum.
- Allocations are rounded to `$50` increments.
- POET is deliberately allowed a smaller asymmetric allocation ceiling.

## Explicit risk controls

- CRDO can score highly but remains WATCH-only while recent volatility makes chasing unattractive.
- SNDK and SPCX are HOLD-only when already owned; the engine does not chase existing winners.
- VERA remains WATCH-only because its risk profile is materially different from the AI-infrastructure mission.

## Human approval

M4 does **not** auto-approve recommendations.

The agent can:
1. Produce a ranked pick.
2. Calculate the exact dollar amount.
3. Calculate approximate shares from the current live price.
4. Queue the recommendation for the existing human approval gate.

Only the user can approve or reject it. Approval updates local portfolio state but does not submit a broker order.

## Market scanning boundary

M4 currently evaluates an explicit strategy universe so the selection logic is transparent and testable. A future market-scanner adapter can supply a larger candidate universe to the same scoring engine. This separation prevents the ranking logic from becoming coupled to one market-data provider.

## Refresh behavior

The 30-second quote refresh only updates prices and re-evaluates the decision model. It does not automatically queue, approve, or execute a trade.

This keeps mark-to-market refresh frequency separate from the eventual intelligence/event-driven decision cadence.
