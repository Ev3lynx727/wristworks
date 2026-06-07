import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { Wristworks } from "../../core/index.js"
import type { WristworksOutput } from "../../core/types.js"

export default function(server: McpServer, instance: Wristworks): void {
  server.tool(
    "get_version",
    "Get the wristworks package version",
    {},
    async (): Promise<{ content: { type: "text"; text: string }[] }> => {
      const out: WristworksOutput = await instance.run()
      return { content: [{ type: "text", text: JSON.stringify({ version: out.audit.version }, null, 2) }] }
    },
  )
}
