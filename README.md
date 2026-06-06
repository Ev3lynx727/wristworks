# @ev3lynx727/wristworks

NTP-calibrated multi-timezone clock fetcher with YAML/ENV config.

## Features

- **NTP calibration** — Rust native addon (`napi-rs`) with pure TS fallback
- **27+ timezone targets** across APAC, US, Europe, Middle East
- **Currency enrichment** — live FX rates from moneyconvert.net (USD) / Frankfurter (EUR)
- **CLI dashboard** — Bloomberg-style with ascii tables, `--watch`, `--json`
- **MCP server** — 8 tools for AI copilot integration
- **DNS tools** — `server-catch` (geo+probe), `server-fetch` (full dns dig)
- **Proxy aware** — multi-proxy support + VPN auto-detection

## Install

```bash
npm install @ev3lynx727/wristworks
```

## Quick Start

```bash
# CLI dashboard
npx wristworks

# Watch mode
npx wristworks --watch --watch-interval 60

# Currency conversion
npx wristworks convert 100 USD to IDR EUR JPY

# JSON output
npx wristworks --json | jq

# DNS tools
npx wristworks server-catch example.com
npx wristworks server-fetch example.com

# MCP server
npx wristworks mcp
```

## Config

Create `wristworks.yaml` or use `.env`:

```yaml
ntpServers:
  - time.google.com
  - time.cloudflare.com

locations:
  - name: Jakarta
    timezone: Asia/Jakarta
    label: ID
```

See `wristworks.yaml` for all 27 targets and full options.

## API

```typescript
import { getTimes, calibrate } from '@ev3lynx727/wristworks'

const { calibration, locations } = await getTimes()
console.log(locations.map(l => `${l.label}: ${l.datetime}`))

const ntpResults = await calibrate()
console.log(ntpResults.map(r => `${r.host}: ${r.driftMs}ms`))
```

## Build

```bash
npm run build:native  # Rust native addon
npm run build         # TS compile
npm run dev           # Dev mode with tsx
```

## License

MIT
