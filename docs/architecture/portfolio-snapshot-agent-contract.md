# Portfolio Snapshot → Analysis Agent Contract

## Source of truth

MilliPort's latest successful portfolio snapshot is authoritative for portfolio state. Conversation history is not allowed to override a newer snapshot.

The dashboard emits `PORTFOLIO_REFRESHED` after a successful market-data refresh and snapshot creation. The event references the immutable `snapshot_id` and includes enough portfolio-level data for immediate routing.

## Flow

```text
Dashboard refresh
      |
      v
Build portfolio snapshot
      |
      +--> local snapshot history (browser, up to 100)
      |
      +--> POST /api/portfolio/{portfolio_id}/snapshots
      |
      v
PORTFOLIO_REFRESHED
      |
      v
Analysis Agent retrieves latest snapshot
      |
      v
Compare previous snapshot -> materiality -> analysis
```

## APIs

- `POST /api/portfolio/{portfolio_id}/snapshots` stores a snapshot and acknowledges `PORTFOLIO_REFRESHED`.
- `GET /api/portfolio/{portfolio_id}/snapshots/latest` is represented by the same route with the default response's `latest` field; `GET ...?limit=30` returns history.

The current API adapter uses process memory as an M4.1 development store. The browser also persists up to 100 snapshots in localStorage. Before production or multi-instance Vercel deployment, replace the API adapter with Supabase/Postgres so snapshot history is durable and shared across instances.

## Data contract

Each snapshot contains:

- explicit cash
- total and invested value
- previous value and change
- position quantity, current price, market value, average cost, cost basis and unrealized P&L
- current and previous position values/allocation where available
- market/portfolio/fundamental/news data status
- $30K target metrics
- immutable initial baseline of $16,469

## Materiality

The analysis agent uses approximately 5% as a materiality threshold for portfolio and position moves. Price movement alone does not imply SELL/EXIT; the alert explicitly asks the downstream decision engine to distinguish price move from thesis change.

## Safety

Portfolio State and Portfolio Analysis are separate. Snapshot data represents what the user owns. Recommendations remain in the existing recommendation state and are never written into snapshots as holdings. Human approval remains ON; auto-approval and broker execution remain OFF.
