import type { PortfolioSnapshot } from "@/lib/portfolio-snapshot";
import {
  getLatestSnapshotFromDatabase,
  isSnapshotDatabaseConfigured,
  listSnapshotsFromDatabase,
  saveSnapshotToDatabase,
} from "@/lib/portfolio-snapshot-db";

// Development-only fallback. Production requires durable Supabase/Postgres storage.
const globalStore = globalThis as typeof globalThis & {
  __milliportSnapshots?: Map<string, PortfolioSnapshot[]>;
};
const store = globalStore.__milliportSnapshots ?? new Map<string, PortfolioSnapshot[]>();
globalStore.__milliportSnapshots = store;

export async function getServerSnapshots(portfolioId: string, limit = 100): Promise<PortfolioSnapshot[]> {
  if (isSnapshotDatabaseConfigured()) return listSnapshotsFromDatabase(portfolioId, limit);
  if (process.env.NODE_ENV === "production") throw new Error("SNAPSHOT_DB_NOT_CONFIGURED");
  return (store.get(portfolioId) ?? []).slice(0, Math.min(Math.max(limit, 1), 100));
}

export async function getLatestServerSnapshot(portfolioId: string): Promise<PortfolioSnapshot | null> {
  if (isSnapshotDatabaseConfigured()) return getLatestSnapshotFromDatabase(portfolioId);
  if (process.env.NODE_ENV === "production") throw new Error("SNAPSHOT_DB_NOT_CONFIGURED");
  return getServerSnapshots(portfolioId, 1).then((snapshots) => snapshots[0] ?? null);
}

export async function saveServerSnapshot(snapshot: PortfolioSnapshot): Promise<PortfolioSnapshot> {
  if (isSnapshotDatabaseConfigured()) {
    await saveSnapshotToDatabase(snapshot);
    return snapshot;
  }
  if (process.env.NODE_ENV === "production") throw new Error("SNAPSHOT_DB_NOT_CONFIGURED");
  const existing = store.get(snapshot.portfolio_id) ?? [];
  const next = [snapshot, ...existing.filter((item) => item.snapshot_id !== snapshot.snapshot_id)].slice(0, 100);
  store.set(snapshot.portfolio_id, next);
  return snapshot;
}
