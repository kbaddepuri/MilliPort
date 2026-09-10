import { NextResponse } from "next/server";
import type { PortfolioSnapshot } from "@/lib/portfolio-snapshot";

export const dynamic = "force-dynamic";

// M4.1 MVP store. The client also keeps a durable local history. Replace this
// adapter with Supabase/Postgres before multi-instance production deployment.
const globalStore = globalThis as typeof globalThis & {
  __milliportSnapshots?: Map<string, PortfolioSnapshot[]>;
};
const store = globalStore.__milliportSnapshots ?? new Map<string, PortfolioSnapshot[]>();
globalStore.__milliportSnapshots = store;

export async function GET(
  request: Request,
  context: { params: Promise<{ portfolioId: string }> },
) {
  const { portfolioId } = await context.params;
  const url = new URL(request.url);
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? 30) || 30, 1), 100);
  const snapshots = (store.get(portfolioId) ?? []).slice(0, limit);
  return NextResponse.json({ ok: true, portfolio_id: portfolioId, snapshots, latest: snapshots[0] ?? null }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ portfolioId: string }> },
) {
  const { portfolioId } = await context.params;
  try {
    const snapshot = await request.json() as PortfolioSnapshot;
    if (snapshot.portfolio_id !== portfolioId || !snapshot.snapshot_id || !snapshot.timestamp) {
      return NextResponse.json({ ok: false, error: "INVALID_SNAPSHOT" }, { status: 400 });
    }
    const existing = store.get(portfolioId) ?? [];
    const next = [snapshot, ...existing.filter((item) => item.snapshot_id !== snapshot.snapshot_id)].slice(0, 100);
    store.set(portfolioId, next);
    return NextResponse.json({ ok: true, snapshot, event: "PORTFOLIO_REFRESHED" }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ ok: false, error: "INVALID_JSON" }, { status: 400 });
  }
}
