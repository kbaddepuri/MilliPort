create table if not exists public.milliport_portfolio_snapshots (
  portfolio_id text not null,
  snapshot_id text primary key,
  timestamp timestamptz not null,
  snapshot jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists milliport_portfolio_snapshots_portfolio_timestamp_idx
  on public.milliport_portfolio_snapshots (portfolio_id, timestamp desc);

alter table public.milliport_portfolio_snapshots enable row level security;

-- Portfolio snapshots are accessed by MilliPort server routes with the service role key.
-- No anonymous/client policy is created, so portfolio data is not publicly readable.
