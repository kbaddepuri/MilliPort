import type { PortfolioSnapshot } from "@/lib/portfolio-snapshot";

// M4.1 MVP store. Replace this adapter with Supabase/Postgres before
// multi-instance production deployment so snapshots are durable and shared.
const globalStore = globalThis as typeof globalThis & {
  __milliportSnapshots?: Map<string, PortfolioSnapshot[]>;
};
const store = globalStore.__milliportSnapshots ?? new Map<string, PortfolioSnapshot[]>();
globalStore.__milliportSnapshots = store;

export function getServerSnapshots(portfolioId: string): PortfolioSnapshot[] {
  return (store.get(portfolioId) ?? []).slice(0, 100);
}

export function getLatestServerSnapshot(portfolioId: string): PortfolioSnapshot | null {
  return getServerSnapshots(portfolioId)[0] ?? null;
}

export function saveServerSnapshot(snapshot: PortfolioSnapshot): PortfolioSnapshot {
  const existing = store.get(snapshot.portfolio_id) ?? [];
  const next = [snapshot, ...existing.filter((item) => item.snapshot_id !== snapshot.snapshot_id)].slice(0, 100);
  store.set(snapshot.portfolio_id, next);
  return snapshot;
}
