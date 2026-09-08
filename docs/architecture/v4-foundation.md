# MilliPort V4 — Foundation

## Product contract

MilliPort is a portfolio intelligence system. The core output is an explicit action with a dollar amount: BUY $X, HOLD $0, WATCH $0, SELL $X, or EXIT $X.

## Architecture direction

```text
Next.js UI
   |
   v
Application/API layer
   |
   +--> Portfolio domain
   +--> Market data adapters
   +--> Intelligence engine
   +--> Persistence
   +--> Scheduled jobs / alerts
```

The first implementation deliberately keeps the portfolio domain independent from market-data providers. Provider integrations will be adapters behind a stable interface.

## Decision engine

Future scoring dimensions:

1. Momentum
2. Fundamentals
3. Valuation
4. Catalysts
5. Risk
6. Portfolio concentration/context

The engine should preserve the evidence behind every recommendation so a user can understand *why* MilliPort selected an action.

## Milestones

- M1: static domain + mission dashboard
- M2: live market-data adapter
- M3: persistent portfolio and transactions
- M4: intelligence scoring
- M5: alerts and scheduled monitoring
- M6: production deployment
