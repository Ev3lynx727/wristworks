import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import type { Wristworks } from "../../core/index.js"
import getTimes from './get_times.js'
import convert from './convert.js'
import calibrate from './calibrate.js'
import ask from './ask.js'
import serverFetch from './server_fetch.js'
import serverCatch from './server_catch.js'
import getVersion from './get_version.js'
import getData from './get_data.js'
import getDataRegions from './get_regions.js'
import getCountry from './get_country.js'
import getEverything from './get_everything.js'
import timezone from './timezone.js'

export function registerAllTools(server: McpServer, instance: Wristworks): void {
  getTimes(server, instance)
  convert(server)
  calibrate(server, instance)
  ask(server)
  serverFetch(server)
  serverCatch(server)
  getVersion(server, instance)
  getEverything(server, instance)
  getData(server)
  getDataRegions(server)
  getCountry(server)
  timezone(server)
}
