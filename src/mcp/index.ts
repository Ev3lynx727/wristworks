import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { Wristworks } from "../core/index.js"
import { registerAllTools } from "./tools/index.js"

export async function createMcpServer(ww?: Wristworks): Promise<McpServer> {
  const instance = ww ?? new Wristworks()
  const server = new McpServer({ name: "wristworks-mcp", version: "0.1.0" })
  registerAllTools(server, instance)
  return server
}

async function startServer(): Promise<void> {
  const server = await createMcpServer()
  const transport = new StdioServerTransport()
  await server.connect(transport)
}

startServer().catch((err: unknown) => {
  console.error("MCP server failed:", err instanceof Error ? err.message : String(err))
  process.exit(1)
})
