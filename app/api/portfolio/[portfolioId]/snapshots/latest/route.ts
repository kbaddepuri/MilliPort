import { NextResponse } from "next/server";
import { getLatestServerSnapshot } from "@/lib/portfolio-snapshot-server";

export const dynamic = "force-dynamic";

function authorized(request: Request): boolean {
  const expected = process.env.MILLIPORT_AGENT_SECRET;
  return Boolean(expected && request.headers.get("authorization") === `Bearer ${expected}`);
}

export async function GET(
  request: Request,
  context: { params: Promise<{ portfolioId: string }> },
) {
  if (!authorized(request)) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  const { portfolioId } = await context.params;
  try {
    const latest = await getLatestServerSnapshot(portfolioId);
    return NextResponse.json({ ok: true, portfolio_id: portfolioId, latest }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ ok: false, error: "SNAPSHOT_STORE_UNAVAILABLE", message: error instanceof Error ? error.message : "Snapshot store unavailable." }, { status: 503 });
  }
}
