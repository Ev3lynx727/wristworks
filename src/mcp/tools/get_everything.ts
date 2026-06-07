import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import type { Wristworks } from "../../core/index.js"
import type { WristworksOutput } from "../../core/types.js"

export default function(server: McpServer, instance: Wristworks): void {
  server.tool(
    "get_everything",
    "Get a comprehensive global snapshot — all timezone locations with current local times, real-time currency rates, NTP calibration status (drift, latency per server), configured server list, and proxy/VPN info. One call returns the full picture from Wristworks.",
    {},
    async (): Promise<{ content: { type: "text"; text: string }[] }> => {
      try {
        const out: WristworksOutput = await instance.run()
        return { content: [{ type: "text", text: JSON.stringify(out, null, 2) }] }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        return { content: [{ type: "text", text: JSON.stringify({ error: msg }, null, 2) }] }
      }
    },
  )
}
