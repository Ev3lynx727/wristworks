import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"

export default function(server: McpServer): void {
  server.tool(
    "lookup_timezone",
    "Look up timezone data using the IANA timezone database. Supports: get timezones for a country (ISO alpha-2 code), get countries using a timezone, search by timezone name, or list all. Returns UTC offsets, DST offsets, country names.",
    {
      action: z.enum(["country-tz", "tz-countries", "get-tz", "get-country", "all-tz", "all-countries"]).describe("Action to perform: 'country-tz' = timezones for a country code, 'tz-countries' = countries using a timezone, 'get-tz' = timezone details by name, 'get-country' = country details by code, 'all-tz' = all timezones, 'all-countries' = all countries"),
      code: z.string().optional().describe("Country code (ISO alpha-2, e.g. 'US', 'ID', 'JP') or timezone name (e.g. 'Asia/Jakarta', 'America/New_York') depending on action"),
    },
    async ({ action, code }): Promise<{ content: { type: "text"; text: string }[] }> => {
      try {
        const { getTimezonesForCountry, getCountriesForTimezone, getTimezone, getCountry, getAllTimezones, getAllCountries } = await import("../../core/timezone-data.js")
        switch (action) {
          case "country-tz": {
            if (!code) throw new Error("code required for country-tz action")
            const tzs = getTimezonesForCountry(code.toUpperCase())
            return { content: [{ type: "text", text: JSON.stringify(tzs ?? { error: `Unknown country: ${code}` }, null, 2) }] }
          }
          case "tz-countries": {
            if (!code) throw new Error("code required for tz-countries action")
            const countries = getCountriesForTimezone(code)
            return { content: [{ type: "text", text: JSON.stringify(countries, null, 2) }] }
          }
          case "get-tz": {
            if (!code) throw new Error("code required for get-tz action")
            const tz = getTimezone(code)
            return { content: [{ type: "text", text: JSON.stringify(tz ?? { error: `Unknown timezone: ${code}` }, null, 2) }] }
          }
          case "get-country": {
            if (!code) throw new Error("code required for get-country action")
            const country = getCountry(code.toUpperCase())
            return { content: [{ type: "text", text: JSON.stringify(country ?? { error: `Unknown country: ${code}` }, null, 2) }] }
          }
          case "all-tz": {
            const all = getAllTimezones()
            return { content: [{ type: "text", text: JSON.stringify(all, null, 2) }] }
          }
          case "all-countries": {
            const all = getAllCountries()
            return { content: [{ type: "text", text: JSON.stringify(all, null, 2) }] }
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        return { content: [{ type: "text", text: JSON.stringify({ error: msg }, null, 2) }] }
      }
    },
  )
}
