import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"

const DEFAULT_INDICATORS = ['NGDP_RPCH', 'NGDPD', 'PCPI', 'LUR', 'GGXWDG_NGDP', 'BCA_NGDPD', 'GGXONLB_NGDP']

export default function(server: McpServer): void {
  server.tool(
    "get_country",
    "Get detailed IMF economic data for a specific country. Returns region classification, GDP growth (NGDP_RPCH), GDP current prices (NGDPD), inflation (PCPI), unemployment (LUR), government debt (GGXWDG_NGDP), current account balance (BCA_NGDPD), net lending/borrowing (GGXONLB_NGDP), and metadata from the IMF World Economic Outlook. Supports period ranges like '2020-2026'. Data cached for 24 hours.",
    {
      code: z.string().min(1).describe("Country code (alpha-2 or alpha-3, e.g. 'US' or 'USA')"),
      periods: z.string().optional().describe("Year or range (e.g. '2024' or '2020-2024'). Default: '2024'."),
      indicators: z.array(z.string()).optional().describe("Specific indicator codes to fetch (default: NGDP_RPCH, NGDPD, PCPI, LUR, GGXWDG_NGDP, BCA_NGDPD, GGXONLB_NGDP)"),
    },
    async ({ code, periods, indicators }): Promise<{ content: { type: "text"; text: string }[] }> => {
      try {
        const { fetchImfSnapshot, fetchIndicator, alpha2to3, countryToRegion, fetchRegions } = await import("../../core/imf.js")
        const a3 = alpha2to3(code)
        if (!a3) throw new Error(`Unknown country code: ${code}`)
        const snapshot = await fetchImfSnapshot(code)
        const regionCode = countryToRegion(code)
        const region = regionCode ? (await fetchRegions()).find(r => r.code === regionCode) ?? null : null
        const indCodes = indicators ?? DEFAULT_INDICATORS
        const per = periods ?? '2024'
        const indicatorResults = await Promise.all(indCodes.map(ind => fetchIndicator(ind, [a3], per).catch(() => null)))
        const indicatorValues: Record<string, unknown> = {}
        for (let i = 0; i < indCodes.length; i++) {
          if (indicatorResults[i]) indicatorValues[indCodes[i]] = indicatorResults[i]
        }
        return { content: [{ type: "text", text: JSON.stringify({
          country: snapshot.countries.find(c => c.code === a3),
          region,
          indicators: indicatorValues,
        }, null, 2) }] }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        return { content: [{ type: "text", text: JSON.stringify({ error: msg }, null, 2) }] }
      }
    },
  )
}
