import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"

export default function(server: McpServer): void {
  server.tool(
    "get_data_regions",
    "Get IMF regional groupings and their member countries. Returns all 28 IMF WEO region codes with descriptive labels (e.g. APQ=Asia & Pacific, WEQ=Western Europe, EUQ=Europe, AFQ=Africa, MEQ=Middle East). When a region code is provided, returns the member countries in that region.",
    {
      region: z.string().optional().describe("Region code to filter (e.g. 'APQ', 'WEQ', 'EUQ', 'AFQ', 'MEQ'). Returns that region's info with member countries."),
    },
    async ({ region }): Promise<{ content: { type: "text"; text: string }[] }> => {
      try {
        const { getCountriesByRegion, fetchRegions } = await import("../../core/imf.js")
        if (region) {
          const result = await getCountriesByRegion(region)
          return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] }
        }
        const regions = await fetchRegions()
        return { content: [{ type: "text", text: JSON.stringify(regions, null, 2) }] }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        return { content: [{ type: "text", text: JSON.stringify({ error: msg }, null, 2) }] }
      }
    },
  )
}
