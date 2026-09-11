import { NextResponse } from "next/server";
import { portfolioMcpHandler } from "@/lib/portfolio-analysis-mcp";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function authorized(request: Request): boolean {
  const expected = process.env.MILLIPORT_AGENT_SECRET;
  return Boolean(
    expected &&
      request.headers.get("authorization") === `Bearer ${expected}`,
  );
}

async function handle(request: Request): Promise<Response> {
  if (!authorized(request)) {
    return NextResponse.json(
      { ok: false, error: "UNAUTHORIZED" },
      { status: 401 },
    );
  }

  return portfolioMcpHandler.fetch(request);
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}

export async function DELETE(request: Request) {
  return handle(request);
}
