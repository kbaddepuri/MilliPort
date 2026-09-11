# Portfolio Analysis Agent Tool Integration

MilliPort is the authoritative source of truth for current portfolio state. The analysis agent must retrieve current state through the named tools rather than conversation memory.

## Tools

### `get_latest_portfolio_snapshot`

Server-side function in `lib/portfolio-analysis-tools.ts` and authenticated HTTP adapter at:

`POST /api/agent/tools/portfolio-snapshot`

Request:

```json
{"tool":"get_latest_portfolio_snapshot","input":{"portfolio_id":"primary"}}
```

The portfolio id is optional and defaults to `primary`.

The response contains current portfolio value, explicit cash, invested value, current positions, cost basis, P&L, previous snapshot fields, freshness, and target tracking. Values are read from the durable snapshot store.

### `get_portfolio_snapshot_history`

Request:

```json
{"tool":"get_portfolio_snapshot_history","input":{"portfolio_id":"primary","limit":30}}
```

The response contains snapshot id, timestamp, and total value for historical comparison.

## Authentication

Agent HTTP calls require:

`Authorization: Bearer $MILLIPORT_AGENT_SECRET`

`SUPABASE_SERVICE_ROLE_KEY` is server-only and is never sent to browser JavaScript or included in prompts.

## Persistence

Production snapshot state is stored in Supabase/Postgres using `milliport_portfolio_snapshots`. RLS is enabled and no anonymous policy is created. The in-memory store remains only as a development fallback; production fails closed when the database is not configured.

## Refresh flow

1. Dashboard obtains a complete live quote set.
2. MilliPort creates a snapshot and persists it to the durable store.
3. MilliPort emits the `PORTFOLIO_REFRESHED` event to the application event surface.
4. The analysis agent independently calls `get_latest_portfolio_snapshot`.
5. The agent compares snapshot history, then performs current market/fundamental/news research.
6. Only materially actionable changes produce alerts/recommendations.

## Source-of-truth hierarchy

1. Latest MilliPort snapshot
2. MilliPort snapshot history
3. Current external market/news/fundamental data
4. Conversation history

The initial baseline remains `$16,469`; it is not overwritten by subsequent snapshots. The target remains `$30,000`.

## Safety

Human approval remains required. Auto-approval is disabled. Broker execution is disabled.
