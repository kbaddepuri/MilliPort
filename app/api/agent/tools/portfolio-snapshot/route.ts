import { NextResponse } from "next/server";
import {
  get_latest_portfolio_snapshot,
  get_portfolio_snapshot_history,
} from "@/lib/portfolio-analysis-tools";

export const dynamic = "force-dynamic";

function authorized(request: Request): boolean {
  const expected = process.env.MILLIPORT_AGENT_SECRET;
  return Boolean(expected && request.headers.get("authorization") === `Bearer ${expected}`);
}

export async function POST(request: Request) {
  if (!authorized(request)) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  try {
    const body = await request.json() as {
      tool?: string;
      input?: { portfolio_id?: string; limit?: number };
    };
    if (body.tool === "get_latest_portfolio_snapshot") {
      return NextResponse.json({ ok: true, tool: body.tool, result: await get_latest_portfolio_snapshot(body.input) }, { headers: { "Cache-Control": "no-store" } });
    }
    if (body.tool === "get_portfolio_snapshot_history") {
      return NextResponse.json({ ok: true, tool: body.tool, result: await get_portfolio_snapshot_history(body.input) }, { headers: { "Cache-Control": "no-store" } });
    }
    return NextResponse.json({ ok: false, error: "UNKNOWN_TOOL" }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Portfolio tool failed.";
    const status = message === "NO_PORTFOLIO_SNAPSHOT" ? 409 : 503;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
