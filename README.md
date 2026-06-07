# @ev3lynx727/wristworks

NTP-calibrated multi-timezone clock fetcher with IMF economic data, live FX rates, DNS tools, and a Bloomberg-style terminal dashboard.

## Features

- **NTP calibration** — multi-server polling (pool.ntp.org, time.google.com, time.cloudflare.com) with Rust native addon + pure TS fallback
- **IMF economic data** — PCPI inflation and GDP ranking (NGDPD) columns in dashboard, color-coded by tier
- **Currency conversion** — 3-source fallback (moneyconvert.net → Frankfurter → ECB), supports multi-to syntax like `ww convert 1000 USD IDR SGD JPY`
- **CLI dashboard** — Bloomberg-style terminal with 10 columns (Ticker, Rate, Change, Timezone, Day, Local, Offset, DST, Infl, GDP), watch mode, epoch footer
- **MCP server** — 10 tools for AI copilot integration (get_times, convert, calibrate, server_fetch, server_catch, get_version, get_everything, get_data, get_country, get_regions)
- **DNS tools** — `server-catch` (geo+probe+URL stripping), `server-fetch` (full DNS dig with all record types)
- **Proxy aware** — multi-proxy support + VPN auto-detection

## Install

```bash
npm install @ev3lynx727/wristworks
```

## Quick Start

```bash
# CLI dashboard
npx wristworks

# Watch mode (updates every 60s)
npx wristworks --watch

# Custom config
npx wristworks --config=./my-config.yaml

# Currency conversion
npx wristworks convert 1 USD IDR                 # single pair
npx wristworks convert 1000 USD IDR SGD JPY      # multi-to
npx wristworks convert --from USD,TWD --to IDR   # flag syntax
npx wristworks convert --config                  # use YAML presets

# IMF economic data
npx wristworks imf regions                       # list IMF WEO regions
npx wristworks imf countries APQ                 # countries by region
npx wristworks imf indicators US --periods 2024  # economic indicators

# DNS tools
npx wristworks server-catch x.com instagram.com
npx wristworks server-catch x.com --probe        # with HTTP probe
npx wristworks server-fetch x.com

# JSON output
npx wristworks --json
npx wristworks convert 1 USD IDR --json

# Debug mode (cache state, rate changes)
npx wristworks --debug

# MCP server (for AI copilot — no install)
npx -y @ev3lynx727/wristworks mcp
```

## Config

Create `wristworks.yaml` in your project root:

```yaml
ntp:
  servers:
    - pool.ntp.org
    - time.google.com
  polls: 5
  poll_interval_ms: 200

targets:
  - name: Jakarta
    timezone: Asia/Jakarta
    label: ID
    countryCode: ID
  - name: New York
    timezone: America/New_York
    label: US
    countryCode: US

currency:
  base: USD
  cache_ttl_secs: 300
  conversions:
    - amount: 1
      from: USD
      to: IDR

servers:
  - name: my-server
    host: example.com
    timezone: Asia/Jakarta
    location: Jakarta Data Center

skip_imf: false     # set true to skip IMF enrichment on dashboard
```

## API

```typescript
import { Wristworks, multiConvert, dnsDig } from '@ev3lynx727/wristworks'

const ww = new Wristworks({ configPath: './wristworks.yaml' })
const { calibration, locations, audit } = await ww.run()

// Each location has IMF enrichment
for (const loc of locations) {
  console.log(`${loc.label}: ${loc.datetime}`)
  if (loc.imf) {
    console.log(`  Inflation: ${loc.imf.indicators.PCPI}%`)
    console.log(`  GDP Rank: #${loc.imf.gdpRank}`)
  }
}

// Currency conversion
const rates = await multiConvert([{ amount: 1, from: 'USD', to: 'IDR' }])

// DNS dig
const dig = await dnsDig('x.com', { probe: true })
```

## Build

```bash
npm run build:native  # Rust native addon (napi-rs)
npm run build         # TS compile
npm run dev           # Dev mode with tsx
npm run typecheck     # tsc --noEmit
npm run lint          # eslint
```

## MCP Integration (Agentic AI)

wristworks exposes all tools via the Model Context Protocol, letting AI agents query times, currencies, economic data, and servers in real time.

### Tools Available

| Tool | Description |
|------|-------------|
| `get_times` | Current times for all configured locations with rates and NTP state |
| `convert` | Real-time currency conversion with 3-source fallback |
| `calibrate` | NTP clock drift measurement per server |
| `server_fetch` | Full DNS dig (A, MX, NS, TXT, CNAME, SOA, etc.) with geo + probe |
| `server_catch` | Resolve domains to IPs with timezone-aware local time and HTTP probe |
| `get_version` | Package version from calibration audit |
| `get_everything` | Comprehensive global snapshot (times + rates + NTP + servers + proxy) |
| `get_data` | IMF economic indicators by country (GDP, inflation, unemployment, debt) |
| `get_country` | Detailed IMF country profile with region classification |
| `get_regions` | IMF WEO regional groupings and member countries |

### Setup (No Install Required)

All examples use `npx -y` so the package runs without cloning or installing globally.

**Cursor / VS Code** — `.mcp.json` is pre-configured at project root:

```json
{
  "mcpServers": {
    "wristworks": {
      "command": "npx",
      "args": ["-y", "@ev3lynx727/wristworks", "mcp"]
    }
  }
}
```

**OpenCode** — add to `opencode.json`:

```json
{
  "mcpServers": {
    "wristworks": {
      "command": "npx",
      "args": ["-y", "@ev3lynx727/wristworks", "mcp"]
    }
  }
}
```

**Claude Desktop** — add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "wristworks": {
      "command": "npx",
      "args": ["-y", "@ev3lynx727/wristworks", "mcp"]
    }
  }
}
```

**Any MCP client** — run directly:

```bash
npx -y @ev3lynx727/wristworks mcp
```

### Example Agent Queries

Once connected, AI agents can answer questions like:

- "What time is it in Jakarta, Tokyo, and New York right now?"
- "Convert 500 USD to IDR, SGD, and JPY"
- "Show me US inflation rate and GDP ranking"
- "What IMF region is Indonesia in?"
- "Is x.com up? What server is it running?"
- "Run NTP calibration and report clock drift"

## License

MIT
