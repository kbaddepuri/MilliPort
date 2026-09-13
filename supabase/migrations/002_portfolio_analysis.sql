create table if not exists public.milliport_portfolio_analysis (
  portfolio_id text not null,
  snapshot_id text primary key,
  timestamp timestamptz not null,
  analysis jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists milliport_portfolio_analysis_portfolio_timestamp_idx
  on public.milliport_portfolio_analysis (portfolio_id, timestamp desc);

alter table public.milliport_portfolio_analysis enable row level security;

-- Analysis results are written/read by MilliPort server routes with the service role key.
-- No anonymous/client policy is created.
