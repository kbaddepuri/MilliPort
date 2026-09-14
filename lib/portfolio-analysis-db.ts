import type { AuthoritativePortfolioAnalysis } from "@/lib/authoritative-portfolio-agent";

const TABLE = "milliport_portfolio_analysis";

function config() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SNAPSHOT_DB_NOT_CONFIGURED");
  return { url: url.replace(/\/$/, ""), key };
}

export async function savePortfolioAnalysis(
  analysis: AuthoritativePortfolioAnalysis,
): Promise<void> {
  const { url, key } = config();
  const response = await fetch(`${url}/rest/v1/${TABLE}`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates",
    },
    cache: "no-store",
    body: JSON.stringify({
      portfolio_id: analysis.source_of_truth.portfolio_id,
      snapshot_id: analysis.source_of_truth.snapshot_id,
      timestamp: analysis.source_of_truth.timestamp,
      analysis,
    }),
  });

  if (!response.ok) {
    throw new Error(`ANALYSIS_DB_WRITE_FAILED:${response.status}`);
  }
}

export async function getLatestPortfolioAnalysis(
  portfolioId: string,
): Promise<AuthoritativePortfolioAnalysis | null> {
  const { url, key } = config();
  const params = new URLSearchParams({
    select: "analysis",
    portfolio_id: `eq.${portfolioId}`,
    order: "timestamp.desc",
    limit: "1",
  });

  const response = await fetch(`${url}/rest/v1/${TABLE}?${params.toString()}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
    cache: "no-store",
  });

  if (!response.ok) throw new Error(`ANALYSIS_DB_READ_FAILED:${response.status}`);
  const rows = (await response.json()) as Array<{ analysis: AuthoritativePortfolioAnalysis }>;
  return rows[0]?.analysis ?? null;
}
