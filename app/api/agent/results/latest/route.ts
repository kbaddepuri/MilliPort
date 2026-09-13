import { NextResponse } from "next/server";
import { PORTFOLIO_ID } from "@/lib/portfolio-snapshot";
import { getLatestPortfolioAnalysis } from "@/lib/portfolio-analysis-db";

export const dynamic = "force-dynamic";

function authorized(request: Request): boolean {
  const expected = process.env.MILLIPORT_ANALYSIS_READ_TOKEN;
  if (!expected) return false;
  const supplied = new URL(request.url).searchParams.get("token");
  return supplied === expected;
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  try {
    const analysis = await getLatestPortfolioAnalysis(PORTFOLIO_ID);
    if (!analysis) {
      return NextResponse.json({ ok: false, error: "NO_ANALYSIS_RESULT" }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      source_of_truth: analysis.source_of_truth,
      previous_snapshot_id: analysis.previous_snapshot_id,
      portfolio: analysis.portfolio,
      target: analysis.target,
      material_changes: analysis.material_changes,
      recommendations: analysis.recommendations,
      full_rankings: analysis.full_rankings,
      data_quality: analysis.data_quality,
      policy: analysis.policy,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: "ANALYSIS_RESULT_UNAVAILABLE",
      message: error instanceof Error ? error.message : "Analysis result unavailable.",
    }, { status: 503 });
  }
}
