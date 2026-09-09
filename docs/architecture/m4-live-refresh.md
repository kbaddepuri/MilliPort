# M4 — Automatic live quote refresh

MilliPort refreshes portfolio quotes automatically every 30 seconds while the dashboard is open.

## Behavior

- Fetches the portfolio, tracked positions, and pending recommendation symbols immediately on load.
- Re-fetches the same symbols every 30 seconds.
- Uses `cache: "no-store"` on the browser request so each refresh asks the MilliPort API for fresh data.
- Keeps the existing server-side market-data provider and 30-second provider revalidation.
- Updates the visible market-data timestamp after each successful refresh.
- Displays `LIVE` when quotes are successfully returned and reports an error/setup state otherwise.

## Portfolio impact

Because portfolio value is calculated from actual tracked shares multiplied by the latest quote, automatic quote refresh also updates:

- portfolio value
- $30K mission progress
- holding market values
- pending-action share estimates

No broker orders are placed by the refresh process.
