import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import { Wristworks } from "../../core/index.js"
import type { WristworksOutput } from "../../core/types.js"

export default function(server: McpServer, instance: Wristworks): void {
  server.tool(
    "get_times",
    "Get current times for all configured timezone locations with real-time currency rates and NTP drift calibration. Returns each location's local time, GMT offset, DST status, day of week, and enriched currency rate. Also returns NTP sync state (stratum, drift, jitter, latency per server) and proxy/VPN info.",
    {
      configPath: z.string().optional().describe("Path to wristworks.yaml config file (default: auto-detect in CWD and ~/.config/wristworks/)"),
      noCurrency: z.boolean().optional().describe("Skip currency rate enrichment — returns only time data"),
    },
    async ({ configPath, noCurrency }): Promise<{ content: { type: "text"; text: string }[] }> => {
      try {
        const wwLocal = configPath ? new Wristworks({ configPath }) : instance
        const out: WristworksOutput = await wwLocal.run()
        if (noCurrency) {
          out.locations.forEach((loc) => { delete (loc as Partial<typeof loc>).currency })
        }
        return { content: [{ type: "text", text: JSON.stringify(out, null, 2) }] }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        return { content: [{ type: "text", text: JSON.stringify({ error: msg }, null, 2) }] }
      }
    },
  )
}
