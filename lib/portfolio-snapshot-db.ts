import type { PortfolioSnapshot } from "@/lib/portfolio-snapshot";

const MAX_SNAPSHOTS = 100;

function config() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key ? { url, key } : null;
}

function endpoint(url: string) {
  return `${url}/rest/v1/milliport_portfolio_snapshots`;
}

function headers(key: string): HeadersInit {
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };
}

export function isSnapshotDatabaseConfigured(): boolean {
  return config() !== null;
}

export async function listSnapshotsFromDatabase(portfolioId: string, limit = 30): Promise<PortfolioSnapshot[]> {
  const cfg = config();
  if (!cfg) return [];
  const safeLimit = Math.min(Math.max(limit, 1), MAX_SNAPSHOTS);
  const response = await fetch(
    `${endpoint(cfg.url)}?portfolio_id=eq.${encodeURIComponent(portfolioId)}&select=snapshot&order=timestamp.desc&limit=${safeLimit}`,
    { headers: headers(cfg.key), cache: "no-store" },
  );
  if (!response.ok) throw new Error(`SNAPSHOT_DB_READ_FAILED:${response.status}`);
  const rows = await response.json() as Array<{ snapshot: PortfolioSnapshot }>;
  return rows.map((row) => row.snapshot).filter(Boolean);
}

export async function saveSnapshotToDatabase(snapshot: PortfolioSnapshot): Promise<void> {
  const cfg = config();
  if (!cfg) throw new Error("SNAPSHOT_DB_NOT_CONFIGURED");
  const response = await fetch(endpoint(cfg.url), {
    method: "POST",
    headers: { ...headers(cfg.key), Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({
      portfolio_id: snapshot.portfolio_id,
      snapshot_id: snapshot.snapshot_id,
      timestamp: snapshot.timestamp,
      snapshot,
    }),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`SNAPSHOT_DB_WRITE_FAILED:${response.status}`);
}

export async function getLatestSnapshotFromDatabase(portfolioId: string): Promise<PortfolioSnapshot | null> {
  const snapshots = await listSnapshotsFromDatabase(portfolioId, 1);
  return snapshots[0] ?? null;
}
