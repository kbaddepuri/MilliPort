# M2 — Live Market Data

M2 replaces the static dashboard-only market layer with a provider-backed server-side quote path.

## Flow

`Dashboard → GET /api/quotes → MarketDataProvider → Finnhub → normalized Quote[]`

The dashboard never calls the vendor directly. This keeps API credentials server-side and makes vendor replacement possible without changing the portfolio UI.

## Contract

`MarketDataProvider` exposes `getQuotes(tickers)` and returns normalized quotes with ticker, price, absolute change, percentage change, currency, and timestamp.

## Provider

The first adapter is Finnhub, selected for a simple quote endpoint and straightforward API-key authentication. The application requires `FINNHUB_API_KEY`; without it the API returns a deliberate `503 MARKET_DATA_NOT_CONFIGURED` response rather than pretending data is live.

## Reliability rules

- Vendor failures become a controlled `502 MARKET_DATA_UNAVAILABLE` response.
- Empty/invalid symbol requests return `400 NO_SYMBOLS`.
- Symbols are deduplicated and capped at 50 per request.
- Provider responses are revalidated for 30 seconds on the server.
- The UI falls back to the existing portfolio snapshot when live data is unavailable.

## M2 boundary

M2 intentionally does **not** calculate investment decisions from live prices yet. The existing dollar actions remain the M1 strategy snapshot. M3 can persist holdings/transactions, and M4 can feed normalized market data into the intelligence engine.
