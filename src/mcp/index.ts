import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { z } from "zod"
import { Wristworks, multiConvert } from "../core/index.js"
import type { WristworksOutput, MultiConvertResult } from "../core/types.js"

export async function createMcpServer(ww?: Wristworks): Promise<McpServer> {
  const instance = ww ?? new Wristworks()
  const server = new McpServer({
    name: "wristworks-mcp",
    version: "0.1.0",
  })

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

  server.tool(
    "convert",
    "Convert between currencies using real-time rates from moneyconvert.net (primary, 5-min updates) with automatic fallback to Frankfurter/ECB. Supports any ISO 4217 currency code. Returns converted amount, rate, source, and timestamp.",
    {
      from: z.string().min(1).toUpperCase().describe("Source currency code (e.g. USD)"),
      to: z.string().min(1).toUpperCase().describe("Target currency code (e.g. IDR)"),
      amount: z.number().positive().default(1).describe("Amount to convert (default: 1)"),
    },
    async ({ from, to, amount }): Promise<{ content: { type: "text"; text: string }[] }> => {
      try {
        const results: MultiConvertResult[] = await multiConvert([{ amount, from, to }])
        return { content: [{ type: "text", text: JSON.stringify(results, null, 2) }] }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        return { content: [{ type: "text", text: JSON.stringify({ error: msg }, null, 2) }] }
      }
    },
  )

  server.tool(
    "calibrate",
    "Run NTP (Network Time Protocol) calibration to measure system clock drift against pool.ntp.org and time.google.com. Returns per-server results including IP, stratum (1=primary, 2-4=secondary, 0=unknown), latency, jitter, packet loss %, and median drift in milliseconds. NTP uses UDP port 123 and bypasses HTTP/SOCKS proxies.",
    {
      polls: z.number().int().positive().max(20).optional().describe("Number of NTP poll requests per server (default: config value, typically 5)"),
      pollIntervalMs: z.number().int().positive().max(5000).optional().describe("Milliseconds between each poll (default: config value, typically 200)"),
    },
    async ({ polls: _polls, pollIntervalMs: _pollIntervalMs }): Promise<{ content: { type: "text"; text: string }[] }> => {
      try {
        const calibrated = await instance.calibrate()
        return { content: [{ type: "text", text: JSON.stringify(calibrated, null, 2) }] }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        return { content: [{ type: "text", text: JSON.stringify({ error: msg }, null, 2) }] }
      }
    },
  )

  server.tool(
    "ask",
    "Ask a natural language question about timezones, currency conversions, server locations, or scheduling across timezones. Uses an Ollama-powered agent (qwen2.5:3b) that can call wristworks tools (get_times, convert, server_catch) to answer intelligently.",
    {
      prompt: z.string().min(1).describe("Natural language question or request (e.g. 'what time is it in Tokyo and Jakarta?', 'convert 500 USD to IDR', 'best posting time for USA from Indonesia')"),
    },
    async ({ prompt: _prompt }): Promise<{ content: { type: "text"; text: string }[] }> => {
      const msg = 'ask tool requires the feat/wristworks-ai-dev branch (git checkout feat/wristworks-ai-dev)'
      return { content: [{ type: "text", text: JSON.stringify({ error: msg }, null, 2) }] }
    },
  )

  server.tool(
    "server_fetch",
    "Comprehensive DNS digging for any domain. Returns ALL record types (A, AAAA, MX, NS, TXT, CNAME, SOA, PTR, CAA), reverse DNS, geo location, timezone, hosting provider, and optional HTTP probe. More thorough than server_catch.",
    {
      domains: z.array(z.string()).describe("Domains to dig — bare names or URLs (e.g. ['x.com', 'https://ev3lynx727.github.io'])"),
      probe: z.boolean().optional().describe("Enable HTTP probe for Server header + up/down status (adds ~500ms per domain)"),
    },
    async ({ domains, probe }): Promise<{ content: { type: "text"; text: string }[] }> => {
      try {
        const { dnsDig } = await import("../core/dns.js")
        const results = await Promise.all(domains.map(d => dnsDig(d, { probe })))
        return { content: [{ type: "text", text: JSON.stringify(results, null, 2) }] }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        return { content: [{ type: "text", text: JSON.stringify({ error: msg }, null, 2) }] }
      }
    },
  )

  server.tool(
    "server_catch",
    "Resolve domains/servers to IP addresses and show their local time, provider, and status. Returns DNS-resolved IP, timezone-aware local time, GMT offset, DST, provider (ASN/ISP), HTTP Server header, and up/down status with response code. Supports configured servers from wristworks.yaml and ad-hoc domain lookups.",
    {
      domains: z.array(z.string()).optional().describe("Domain names to resolve and catch (e.g. ['x.com', 'instagram.com'])"),
      timezone: z.string().optional().describe("Timezone hint for ad-hoc domains (e.g. 'Asia/Tokyo')"),
      probe: z.boolean().optional().describe("Enable HTTP probe to check Server header and up/down status"),
    },
    async ({ domains, timezone, probe }): Promise<{ content: { type: "text"; text: string }[] }> => {
      try {
        const { loadConfig } = await import("../core/config.js")
        const { lookupIpWithLocation } = await import("../core/geo.js")
        const { probeHttp } = await import("../core/probe.js")
        const { resolve4 } = await import("node:dns/promises")
        const cfg = loadConfig()
        const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

        function tzTime(tz: string): { datetime: string; offset: string; dstActive: boolean; day: string } {
          const now = new Date()
          const fmt = new Intl.DateTimeFormat('en-CA', {
            timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
          })
          const parts = fmt.formatToParts(now)
          const get = (t: string) => parts.find(p => p.type === t)?.value || ''
          const datetime = `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:${get('second')}`
          const offsetFmt = new Intl.DateTimeFormat('en-CA', { timeZone: tz, timeZoneName: 'shortOffset' })
          const offsetRaw = offsetFmt.formatToParts(now).find(p => p.type === 'timeZoneName')?.value || ''
          const offset = offsetRaw === 'GMT' ? 'GMT+0' : offsetRaw.replace('GMT', 'GMT')
          const dstJan = new Intl.DateTimeFormat('en-CA', { timeZone: tz, timeZoneName: 'short' }).format(new Date(now.getFullYear(), 0, 1))
          const dstJul = new Intl.DateTimeFormat('en-CA', { timeZone: tz, timeZoneName: 'short' }).format(new Date(now.getFullYear(), 6, 1))
          return { datetime, offset, dstActive: dstJan !== dstJul, day: DAYS[now.getDay()] }
        }

        const entries: Record<string, unknown>[] = []
        for (const sv of cfg.servers ?? []) {
          let ip = sv.host
          try { const a = await resolve4(sv.host); if (a.length > 0) ip = a[0] } catch {}
          const t = tzTime(sv.timezone)
          entries.push({ name: sv.name, host: sv.host, ip, location: sv.location, timezone: sv.timezone, provider: sv.provider, ...t })
        }
        for (const d of domains ?? []) {
          let ip = d
          try { const a = await resolve4(d); if (a.length > 0) ip = a[0] } catch {}
          const geo = await lookupIpWithLocation(d, ip)
          const tz = timezone || geo.timezone
          const t = tzTime(tz)
          entries.push({ name: d, host: d, ip, location: timezone || geo.location, timezone: tz, provider: geo.provider, ...t })
        }

        if (probe) {
          await Promise.all(entries.map(async (e: Record<string, unknown>) => {
            const p = await probeHttp(e.host as string)
            e.up = p.up
            e.server = p.server
            e.statusCode = p.statusCode
            e.probeLatencyMs = p.latencyMs
          }))
        }

        return { content: [{ type: "text", text: JSON.stringify(entries, null, 2) }] }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        return { content: [{ type: "text", text: JSON.stringify({ error: msg }, null, 2) }] }
      }
    },
  )

  server.tool(
    "get_version",
    "Get the wristworks package version",
    {},
    async (): Promise<{ content: { type: "text"; text: string }[] }> => {
      const out: WristworksOutput = await instance.run()
      return { content: [{ type: "text", text: JSON.stringify({ version: out.audit.version }, null, 2) }] }
    },
  )

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
