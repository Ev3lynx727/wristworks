import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"

export default function(server: McpServer): void {
  server.tool(
    "server_fetch",
    "Comprehensive DNS digging for any domain. Returns ALL record types (A, AAAA, MX, NS, TXT, CNAME, SOA, PTR, CAA), reverse DNS, geo location, timezone, hosting provider, and optional HTTP probe. More thorough than server_catch.",
    {
      domains: z.array(z.string()).describe("Domains to dig — bare names or URLs (e.g. ['x.com', 'https://ev3lynx727.github.io'])"),
      probe: z.boolean().optional().describe("Enable HTTP probe for Server header + up/down status (adds ~500ms per domain)"),
    },
    async ({ domains, probe }): Promise<{ content: { type: "text"; text: string }[] }> => {
      try {
        const { dnsDig } = await import("../../core/dns.js")
        const results = await Promise.all(domains.map(d => dnsDig(d, { probe })))
        return { content: [{ type: "text", text: JSON.stringify(results, null, 2) }] }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        return { content: [{ type: "text", text: JSON.stringify({ error: msg }, null, 2) }] }
      }
    },
  )
}
