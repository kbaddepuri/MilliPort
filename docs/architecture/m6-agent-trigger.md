# M6 — Snapshot-Driven Agent Trigger

## Purpose

Allow the external Portfolio Analysis Agent to trigger the existing MilliPort analysis flow without receiving `MILLIPORT_AGENT_SECRET` or any Supabase credentials.

## Flow

```text
External Agent
    |
    | GET /api/agent/run?token=<trigger-token>
    v
MilliPort trigger route
    |
    | server-side Authorization: Bearer MILLIPORT_AGENT_SECRET
    v
/api/agent/hourly
    |
    +--> latest successful Supabase snapshot
    +--> previous snapshot
    +--> fresh market quotes
    +--> authoritative portfolio analysis
    +--> decision engine
    v
Analysis response
```

The trigger route contains no portfolio logic. It delegates to the existing protected hourly route, so the same validation and decision path is used for scheduled and manually triggered runs.

## Authentication

- `MILLIPORT_AGENT_SECRET` remains private and is used only server-to-server.
- `MILLIPORT_AGENT_TRIGGER_TOKEN` is a separate credential intended for the external agent trigger.
- The trigger token is supplied as a query parameter because the external agent must be able to call the endpoint without setting a custom Authorization header.
- Never commit either secret to the repository.

## Source of truth

The triggered analysis still treats the newest successful MilliPort/Supabase portfolio snapshot as authoritative. Conversation history is not a fallback when a newer snapshot exists.

## Safety

The endpoint only runs analysis. It does not place, approve, or execute trades. Human approval remains required.
