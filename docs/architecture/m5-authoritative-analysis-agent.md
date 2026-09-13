# M5 — Authoritative Portfolio Analysis Agent

## Goal

Make the Portfolio Analysis Agent consume the latest successful MilliPort snapshot from Supabase as the authoritative portfolio state.

## Source hierarchy

1. Latest MilliPort snapshot in Supabase
2. Previous MilliPort snapshot history
3. Fresh market quotes used for current decision scoring
4. Fundamental/news integrations when configured
5. Conversation history is not used as current portfolio state

## Flow

`dashboard refresh → Supabase snapshot → analysis agent → previous snapshot comparison → fresh market quotes → decision engine → approval queue`

The agent refuses to analyze when there is no snapshot, when the snapshot is not actionable, or when the snapshot is older than two hours.

## Outputs

The agent returns:

- authoritative `snapshot_id` and timestamp
- current portfolio value, cash, invested value and target gap
- previous snapshot ID
- per-holding allocation, P&L and movement since the previous snapshot
- material-change alerts
- full strategy rankings
- actionable BUY/SELL recommendations with dollar amounts
- data-quality status
- human-approval policy

## Safety

The agent never executes trades. Recommendations require human approval. No broker mutation is exposed by this milestone.

## Acceptance test

If the dashboard refresh creates a snapshot changing the portfolio from `$16,469` to `$16,021`, the agent must return the new snapshot ID/value as current and use `$16,469` only as the immutable initial baseline.
