import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import { multiConvert } from "../../core/index.js"
import type { MultiConvertResult } from "../../core/types.js"

export default function(server: McpServer): void {
  server.tool(
    "convert",
    "Convert between currencies using real-time rates from moneyconvert.net (primary, 5-min updates) with automatic fallback to Frankfurter/ECB. Supports any ISO 4217 currency code. Returns converted amount, rate, source, and timestamp.",
    {
      from: z.string().min(1).toUpperCase().describe("Source currency code (e.g. USD)"),
      to: z.string().min(1).toUpperCase().describe("Target currency code (e.g. IDR)"),
      amount: z.number().positive().default(1).describe("Amount to convert (default: 1)"),
    },
    async ({ from, to, amount }): Promise<{ content: { type: "text"; text: string }[] }> => {
      try {
        const results: MultiConvertResult[] = await multiConvert([{ amount, from, to }])
        return { content: [{ type: "text", text: JSON.stringify(results, null, 2) }] }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        return { content: [{ type: "text", text: JSON.stringify({ error: msg }, null, 2) }] }
      }
    },
  )
}
