import { NextResponse } from "next/server";
import { GET as runHourlyAnalysis } from "@/app/api/agent/hourly/route";

export const dynamic = "force-dynamic";

/**
 * External agent trigger.
 *
 * The caller only needs the dedicated trigger token; the internal hourly
 * analysis route continues to use MILLIPORT_AGENT_SECRET and remains private.
 * This keeps Supabase credentials and the primary agent secret server-side.
 */
function unauthorized(request: Request): boolean {
  const expected = process.env.MILLIPORT_AGENT_TRIGGER_TOKEN;
  if (!expected) return true;

  const supplied = new URL(request.url).searchParams.get("token");
  return !supplied || supplied !== expected;
}

export async function GET(request: Request) {
  if (unauthorized(request)) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  // Re-enter the existing protected analysis flow with the server-side
  // primary secret. No portfolio logic is duplicated here.
  const internalRequest = new Request(new URL("/api/agent/hourly", request.url), {
    method: "GET",
    headers: {
      authorization: `Bearer ${process.env.MILLIPORT_AGENT_SECRET ?? ""}`,
    },
  });

  return runHourlyAnalysis(internalRequest);
}
