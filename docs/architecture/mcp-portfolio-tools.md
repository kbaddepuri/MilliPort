# MilliPort Portfolio MCP Tools

## Purpose

Expose the authoritative MilliPort portfolio snapshot store as read-only Model Context Protocol (MCP) tools so an external agent can retrieve current portfolio state without relying on conversational history.

## Endpoint

Production endpoint:

`https://milli-port.vercel.app/api/mcp`

Authentication:

`Authorization: Bearer $MILLIPORT_AGENT_SECRET`

The secret remains server-side in Vercel and is never exposed to the dashboard or MCP tool output.

## Tools

### `get_latest_portfolio_snapshot`

Input:

```json
{
  "portfolio_id": "primary"
}
```

Returns the latest authoritative snapshot, including portfolio value, cash, invested value, previous value, change, positions, P&L, previous position state, freshness/data status, and $30K target metrics.

### `get_portfolio_snapshot_history`

Input:

```json
{
  "portfolio_id": "primary",
  "limit": 30
}
```

Returns historical snapshot metadata for comparison and trend analysis.

## Source-of-truth rule

When these tools are available to the Portfolio Analysis Agent:

1. `get_latest_portfolio_snapshot` is the authoritative source for current portfolio state.
2. Snapshot history is used for previous-state comparison.
3. External market/news/fundamental data is used only to enrich analysis.
4. Conversation history must not override a newer MilliPort snapshot.
5. The initial `$16,469` value remains a baseline only; it is not treated as the current value after a newer snapshot exists.

## Security

The endpoint is read-only for the exposed tools. No broker execution, portfolio mutation, or recommendation approval operation is exposed through MCP.

The existing `MILLIPORT_AGENT_SECRET` authentication is retained. A ChatGPT custom MCP app/connector can supply the secret as its server-to-server bearer credential where supported.
