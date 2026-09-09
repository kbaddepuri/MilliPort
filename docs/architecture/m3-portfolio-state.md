# M3 — Portfolio State & Human Approval

## Goal

Persist the portfolio state required to turn dollar recommendations into tracked positions while keeping a hard human approval gate before any transaction is recorded.

## State model

- `cash` — recorded cash balance.
- `positions[]` — ticker, shares, average cost, and whether the quantity is `DERIVED` or `MANUAL`.
- `transactions[]` — immutable in-app record of approved BUY/SELL decisions.
- `recommendations[]` — agent decisions with `PENDING`, `APPROVED`, or `REJECTED` status.

## Dollar-first decision flow

1. MilliPort receives a recommendation such as `BUY $500 QCOM`.
2. The current live quote is used to calculate the required share quantity.
3. The user explicitly approves or rejects the recommendation.
4. Approval updates recorded cash and creates/updates a `DERIVED` position.
5. The approved position immediately appears in Holdings and Portfolio Value.
6. A transaction record is written to the local state.
7. No broker order is placed.

## Share quantity policy

Existing holdings use approximate imported broker quantities as `DERIVED` values until exact broker quantities are supplied. Users may enter an exact broker quantity at any time; `MANUAL` values take precedence. Clearing a manual quantity returns the position to automatic derivation.

## Storage

M3 uses browser `localStorage` as a deliberately temporary persistence layer. The storage boundary is isolated behind a state key so the next milestone can replace browser persistence with a database adapter without changing the approval UX.

## Safety boundary

MilliPort is a decision engine, not an autonomous trading system. Recommendations can be generated automatically, but the user must approve each transaction. Broker execution is explicitly outside M3.

## UI ordering

The original portfolio summary metrics remain directly beneath the mission hero: Snapshot P&L, Invested Value, Storage, and Market Data. Operational M3 metrics follow them. This keeps the dashboard's original top-level visual hierarchy while adding the approval/state workflow below it.
