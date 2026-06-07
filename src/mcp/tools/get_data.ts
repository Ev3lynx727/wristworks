import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"

const DEFAULT_INDICATORS = ['NGDP_RPCH', 'NGDPD', 'PCPI', 'LUR', 'GGXWDG_NGDP', 'BCA_NGDPD', 'GGXONLB_NGDP']

export default function(server: McpServer): void {
  server.tool(
    "get_data",
    "Get unified IMF DataMapper data. Returns all regions, countries, and economic indicator definitions from the International Monetary Fund. Optionally filter by country code to get indicator values (GDP growth, GDP current prices, inflation, unemployment, govt debt, current account balance, net lending/borrowing). Supports period ranges like '2020-2026' or '2024'. Data cached for 24 hours.",
    {
      code: z.string().optional().describe("Country code (alpha-2 or alpha-3, e.g. 'US' or 'USA'). When provided, returns indicator values for the country alongside metadata."),
      periods: z.string().optional().describe("Year or period range (e.g. '2024' or '2020-2024'). Default: latest available."),
      indicators: z.array(z.string()).optional().describe("Specific indicator codes to fetch (default: NGDP_RPCH, NGDPD, PCPI, LUR, GGXWDG_NGDP, BCA_NGDPD, GGXONLB_NGDP)"),
    },
    async ({ code, periods, indicators }): Promise<{ content: { type: "text"; text: string }[] }> => {
      try {
        const { fetchRegions, fetchCountries, fetchIndicatorsMeta, fetchImfSnapshot, fetchIndicator, alpha2to3 } = await import("../../core/imf.js")
        if (code) {
          const a3 = alpha2to3(code)
          if (!a3) throw new Error(`Unknown country code: ${code}`)
          const indCodes = indicators ?? DEFAULT_INDICATORS
          const per = periods ?? '2024'
          const [snapshot, ...indicatorResults] = await Promise.all([
            fetchImfSnapshot(code),
            ...indCodes.map(ind => fetchIndicator(ind, [a3], per).catch(() => null)),
          ])
          const indMap: Record<string, unknown> = {}
          for (let i = 0; i < indCodes.length; i++) {
            if (indicatorResults[i]) indMap[indCodes[i]] = indicatorResults[i]
          }
          return { content: [{ type: "text", text: JSON.stringify({ snapshot, indicators: indMap }, null, 2) }] }
        }
        const [regions, countries, indicatorMeta] = await Promise.all([fetchRegions(), fetchCountries(), fetchIndicatorsMeta()])
        return { content: [{ type: "text", text: JSON.stringify({ regions, countries, indicators: indicatorMeta }, null, 2) }] }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        return { content: [{ type: "text", text: JSON.stringify({ error: msg }, null, 2) }] }
      }
    },
  )
}
