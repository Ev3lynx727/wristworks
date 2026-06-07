import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"

export default function(server: McpServer): void {
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
        const { loadConfig } = await import("../../core/config.js")
        const { lookupIpWithLocation } = await import("../../core/geo.js")
        const { probeHttp } = await import("../../core/probe.js")
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
}
