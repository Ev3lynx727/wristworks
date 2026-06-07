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

# MCP server (for AI copilot)
npx wristworks mcp
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

## License

MIT
