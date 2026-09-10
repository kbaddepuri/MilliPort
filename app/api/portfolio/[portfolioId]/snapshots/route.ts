import { NextResponse } from "next/server";
import type { PortfolioSnapshot } from "@/lib/portfolio-snapshot";
import { getServerSnapshots, saveServerSnapshot } from "@/lib/portfolio-snapshot-server";

export const dynamic = "force-dynamic";

function agentAuthorized(request: Request): boolean {
  const expected = process.env.MILLIPORT_AGENT_SECRET;
  return Boolean(expected && request.headers.get("authorization") === `Bearer ${expected}`);
}

function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  return origin === new URL(request.url).origin;
}

export async function GET(
  request: Request,
  context: { params: Promise<{ portfolioId: string }> },
) {
  if (!agentAuthorized(request)) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  const { portfolioId } = await context.params;
  const url = new URL(request.url);
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? 30) || 30, 1), 100);
  try {
    const snapshots = await getServerSnapshots(portfolioId, limit);
    return NextResponse.json({ ok: true, portfolio_id: portfolioId, snapshots, latest: snapshots[0] ?? null }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ ok: false, error: "SNAPSHOT_STORE_UNAVAILABLE", message: error instanceof Error ? error.message : "Snapshot store unavailable." }, { status: 503 });
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ portfolioId: string }> },
) {
  if (!sameOrigin(request)) return NextResponse.json({ ok: false, error: "INVALID_ORIGIN" }, { status: 403 });
  const { portfolioId } = await context.params;
  try {
    const snapshot = await request.json() as PortfolioSnapshot;
    if (snapshot.portfolio_id !== portfolioId || !snapshot.snapshot_id || !snapshot.timestamp) {
      return NextResponse.json({ ok: false, error: "INVALID_SNAPSHOT" }, { status: 400 });
    }
    await saveServerSnapshot(snapshot);
    return NextResponse.json({ ok: true, snapshot, event: "PORTFOLIO_REFRESHED" }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ ok: false, error: "SNAPSHOT_STORE_UNAVAILABLE", message: error instanceof Error ? error.message : "Snapshot store unavailable." }, { status: 503 });
  }
}
