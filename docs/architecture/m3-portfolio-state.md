# MilliPort V4 — M3 Portfolio State & Approval

## Goal

M3 turns the dashboard into a stateful portfolio decision surface. The agent may change recommendations, but it cannot change the user's portfolio without an explicit approval.

## M3 behavior

1. Market/news intelligence produces a recommendation such as `BUY $500 QCOM`.
2. The recommendation enters the Pending Actions queue.
3. The user reviews the ticker, dollar amount, thesis, live price, and estimated shares.
4. `Approve` records the intended portfolio transaction in MilliPort.
5. `Reject` records the decision without changing the portfolio.
6. No broker order is placed by the M3 implementation.

## State model

- `cash`: recorded available cash.
- `positions`: ticker, exact shares, and average cost.
- `transactions`: immutable-ish audit records for approved BUY/SELL actions.
- `recommendations`: agent decisions with PENDING/APPROVED/REJECTED state.

## Persistence

M3 uses browser `localStorage` so the approval workflow is usable immediately without requiring a database credential. The storage key is `milliport:m3:portfolio-state`.

This is deliberately an M3 stepping stone, not the final multi-device persistence layer. The next persistence milestone can replace the storage implementation with Supabase/Postgres while keeping the domain model and approval contract intact.

## Exact shares

The initial portfolio snapshot does not contain authoritative broker share quantities. M3 therefore does not invent them. Users enter the exact quantity from their broker for each holding. Once recorded, live quote × exact shares becomes the position market value.

## Approval rules

- BUY requires a live quote and sufficient recorded cash.
- SELL requires a live quote and a recorded position with enough shares.
- The transaction quantity is derived from `approved dollar amount / live price`.
- BUY updates cash downward and position shares/average cost upward.
- SELL updates cash upward and position shares downward.
- HOLD/WATCH/EXIT recommendations are not executable in the M3 approval flow.

## Safety boundary

The hourly intelligence agent does not have permission to mutate portfolio state or place trades. It can create or update recommendations. Portfolio mutation requires the user's explicit dashboard approval.

## Future evolution

- M3.1: server-backed repository abstraction.
- M3.2: Supabase/Postgres persistence and authentication.
- M4: persisted screener + intelligence decisions.
- Future broker integration: separate explicit broker-execution permission; never silently equate approval with a live broker order.
