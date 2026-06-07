# Changelog

## v0.2.0 (2026-06-07)

### Added
- IMF PCPI (inflation) column in dashboard, color-coded by tier (<3% green, <6% yellow, >=6% red)
- GDP ranking column in dashboard (Worldometers/IMF-based, color-coded by rank top 10/30/60)
- `countries-and-timezones` integration: `ww tz` CLI subcommand (country, tz, info, list)
- MCP tool `lookup_timezone` with 6 actions (country-tz, tz-countries, get-tz, get-country, all-tz, all-countries)
- Inflation/GDP legend in dashboard footer showing color tiers
- `fetchGdpRankings()` that fetches NGDPD for all countries and assigns global rank
- Multi-to conversion syntax: `ww convert 1000 USD IDR SGD JPY`
- `parseAmount()` for locale-aware number parsing (IDR thousands separators)
- `--config=<path>` flag for custom YAML config path
- `--region=<name>` / `-r` flag passthrough
- `--list-regions` flag
- Epoch seconds + 3-zone clock (UTC/Jakarta/NY) in dashboard footer
- `get_everything` MCP tool returning full global snapshot
- `parseEnvVar()` helper for `${VAR}` env resolution in YAML values
- `stripUrl()` URL normalization in `server-catch`
- `skipImf` config option to disable IMF enrichment on dashboard ticks
- `gdpRank` field on `ImfEnrichment` type

### Fixed
- IMF region lookup in `enrichLocationsWithImf()` — was using broken `country.code.slice(0,3)` heuristic that never matched region codes; now uses `countryToRegion()`
- IMF enrichment now warns on failure instead of silent `.catch(() => null)`
- Node 22+ `match` naming collision in `fetcher.ts` (renamed to `matched`)
- Extra indent on `indicators` subcommand help line in CLI

### Changed
- Dashboard expands to 11 columns: Ticker, Rate, Change, Timezone, Day, Date, Local, Offset, DST, Infl, GDP
- MCP tool `get_data_regions` renamed to `get_regions`
- `enrichLocationsWithImf()` accepts optional `{ periods?, indicators? }` options

## v0.1.0 (2026-05-??)

### Added
- NTP calibration with multi-server polling (pool.ntp.org, time.google.com, time.cloudflare.com)
- Multi-timezone clock fetching with DST detection
- Currency conversion with 3-source fallback (moneyconvert.net → Frankfurter → ECB)
- IMF DataMapper integration (regions, countries, indicators, enrichment)
- Bloomberg-style terminal dashboard with watch mode
- DNS digging (`server-fetch`) with all record types + HTTP probe
- Server catching (`server-catch`) with timezone-aware local times
- Proxy/VPN detection
- YAML (`wristworks.yaml`) and environment variable configuration
- MCP server with 9 tools (get_times, convert, calibrate, ask, server_fetch, server_catch, get_version, get_data, get_data_regions, get_country)
- Rust native addon (napi-rs) for performance-critical paths
- Caching layer with TTL-based freshness
