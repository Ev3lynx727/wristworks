import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import { Wristworks } from "../../core/index.js"

export default function(server: McpServer, instance: Wristworks): void {
  server.tool(
    "calibrate",
    "Run NTP (Network Time Protocol) calibration to measure system clock drift against pool.ntp.org and time.google.com. Returns per-server results including IP, stratum (1=primary, 2-4=secondary, 0=unknown), latency, jitter, packet loss %, and median drift in milliseconds. NTP uses UDP port 123 and bypasses HTTP/SOCKS proxies.",
    {
      polls: z.number().int().positive().max(20).optional().describe("Number of NTP poll requests per server (default: config value, typically 5)"),
      pollIntervalMs: z.number().int().positive().max(5000).optional().describe("Milliseconds between each poll (default: config value, typically 200)"),
    },
    async (): Promise<{ content: { type: "text"; text: string }[] }> => {
      try {
        const calibrated = await instance.calibrate()
        return { content: [{ type: "text", text: JSON.stringify(calibrated, null, 2) }] }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        return { content: [{ type: "text", text: JSON.stringify({ error: msg }, null, 2) }] }
      }
    },
  )
}
