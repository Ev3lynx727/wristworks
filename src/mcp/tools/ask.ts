import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"

export default function(server: McpServer): void {
  server.tool(
    "ask",
    "Ask a natural language question about timezones, currency conversions, server locations, or scheduling across timezones. Uses an Ollama-powered agent (qwen2.5:3b) that can call wristworks tools (get_times, convert, server_catch) to answer intelligently.",
    {
      prompt: z.string().min(1).describe("Natural language question or request (e.g. 'what time is it in Tokyo and Jakarta?', 'convert 500 USD to IDR', 'best posting time for USA from Indonesia')"),
    },
    async (): Promise<{ content: { type: "text"; text: string }[] }> => {
      const msg = 'ask tool requires the feat/wristworks-ai-dev branch (git checkout feat/wristworks-ai-dev)'
      return { content: [{ type: "text", text: JSON.stringify({ error: msg }, null, 2) }] }
    },
  )
}
