import { createMcpHandler, McpServer } from "@modelcontextprotocol/server";
import * as z from "zod";
import {
  get_latest_portfolio_snapshot,
  get_portfolio_snapshot_history,
} from "@/lib/portfolio-analysis-tools";

const latestInput = z.object({
  portfolio_id: z.string().default("primary").optional(),
});

const historyInput = z.object({
  portfolio_id: z.string().default("primary").optional(),
  limit: z.number().int().min(1).max(100).default(30).optional(),
});

function createPortfolioMcpServer() {
  const server = new McpServer({
    name: "milliport-portfolio",
    version: "1.0.0",
  });

  server.registerTool(
    "get_latest_portfolio_snapshot",
    {
      title: "Get Latest Portfolio Snapshot",
      description:
        "Returns the authoritative latest MilliPort portfolio snapshot. Use this as the single source of truth for current portfolio value, cash, positions, P&L, previous snapshot values, freshness, and the $30K target metrics. Never substitute conversational or cached portfolio values when this tool is available.",
      inputSchema: latestInput,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (input) => {
      const result = await get_latest_portfolio_snapshot(input);
      return {
        content: [{ type: "text", text: JSON.stringify(result) }],
        structuredContent: result,
      };
    },
  );

  server.registerTool(
    "get_portfolio_snapshot_history",
    {
      title: "Get Portfolio Snapshot History",
      description:
        "Returns historical MilliPort portfolio snapshots for comparison with the current authoritative snapshot. Use this to identify portfolio value changes and prior position state.",
      inputSchema: historyInput,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (input) => {
      const result = await get_portfolio_snapshot_history(input);
      return {
        content: [{ type: "text", text: JSON.stringify(result) }],
        structuredContent: result,
      };
    },
  );

  return server;
}

export const portfolioMcpHandler = createMcpHandler(createPortfolioMcpServer);
