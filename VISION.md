# wristworks-ai — Vision

> wristworks module (NTP clock) + ipgeo (geolocation) + LLM + built-in tools = one AI time assistant.

wristworks-ai is the evolution of wristworks from a time-fetching module into a full AI-powered time intelligence CLI. It combines the NTP-calibrated clock core with real geolocation data, natural language understanding, and interactive tools — all behind a single `ww` command.

---

## Architecture

```
wristworks-ai (CLI / TUI / Daemon)
  |
  +-- wristworks (npm module)     # Rust+TS hybrid NTP clock core
  |     - multi-poll drift calibration
  |     - 22+ timezones with DST detection
  |     - proxy/VPN detection
  |
  +-- ipgeo-client                # ip-geolocation-api-sdk-typescript
  |     - enrich proxy output with real country/city/ISP
  |     - IP security scoring (threatScore, isVpn, isProxy, isTor)
  |     - astronomy (sunrise/sunset per location)
  |     - timezone by IP or coordinates
  |
  +-- LLM engine                  # Ollama (local) + API fallback
  |     - natural language time queries
  |     - meeting scheduling across timezones
  |     - working hour awareness, holiday data
  |
  +-- built-in tools
        - world clock TUI (live grid, color-coded)
        - meeting overlap finder
        - timezone converter (interactive)
        - DST change calendar + alerts
        - sunrise/sunset calendar
```

---

## Commands

| Command | What it does | Powered by |
|---------|-------------|------------|
| `ww` | Smart time dashboard (default) | wristworks + ipgeo |
| `ww ask "..."` | Natural language time query | LLM + wristworks |
| `ww geo <ip>` | IP geolocation | ipgeo SDK |
| `ww security <ip>` | Proxy/VPN/Tor detection + scoring | ipgeo SDK (include: security) |
| `ww astro <city>` | Sunrise/sunset/moon | ipgeo astronomy API |
| `ww tui` | Full-screen terminal dashboard | blessed + WS server |
| `ww serve` | WebSocket daemon | wristworks WS |
| `ww schedule` | Meeting overlap calculator | wristworks + LLM |
| `ww convert <from> <to>` | Timezone converter | wristworks |
| `ww dst` | DST change calendar | wristworks + ipgeo |
| `ww proxy` | Enriched proxy check | wristworks + ipgeo SDK |

---

## LLM Integration: Three Modes

| Mode | Provider | When |
|------|----------|------|
| Local | Ollama (llama3.2, mistral) | Privacy, offline, no cost |
| Cloud | OpenAI / Anthropic | Smarter responses, function calling |
| None | Rule-based engine | No LLM dependency |

### Example: `ww ask` queries

```
ww ask "schedule a 1-hour meeting for team in Jakarta, London, and SF"
-> Best overlap: 14:00-15:00 UTC (21:00 JKT, 15:00 LON, 07:00 SF)
   Note: SF is 07:00 — outside typical hours but best available

ww ask "when does DST end in New York this year"
-> DST ends November 1, 2026 at 2:00 AM EDT

ww ask "what time is it in Tokyo when it's 9 AM in London"
-> 09:00 London BST = 17:00 Tokyo JST

ww ask "i have meetings at 10am NYC, 3pm London, 7pm Dubai — UTC timeline?"
-> 10:00 NYC = 14:00 UTC | 15:00 London = 14:00 UTC | 19:00 Dubai = 15:00 UTC
```

The LLM is given function-calling access to wristworks data (current times, offsets, DST status) so answers are factual, not hallucinated.

---

## Output Example: `ww`

```
┌─────────────────────────────────────────────────────┐
│  wristworks-ai                         v0.2.0       │
│  Calibrated: NTP (5 polls, median 618ms drift)      │
├─────────────────────────────────────────────────────┤
│  Jakarta      04:18 AM  GMT+7           ID          │
│  New York     05:18 PM  GMT-4  DST      US          │
│  London       10:18 PM  GMT+1  DST      GB          │
│  Tokyo        06:18 AM  GMT+9           JP          │
│  Sydney       07:18 AM  GMT+10          AU          │
│  Dubai        01:18 AM  GMT+4           AE          │
├─────────────────────────────────────────────────────┤
│  Sunrise Jakarta 05:56 | Sunset 17:45               │
│  Proxy: socks5://... (US, threatScore: 12)          │
│  Next sync: 30s                                     │
└─────────────────────────────────────────────────────┘
```

---

## Package Structure

```
wristworks-ai/
+-- src/
|   +-- cli.ts              # Entry point (ww command)
|   +-- commands/
|   |   +-- now.ts          # ww — dashboard
|   |   +-- ask.ts          # ww ask — LLM queries
|   |   +-- geo.ts          # ww geo
|   |   +-- security.ts     # ww security
|   |   +-- astro.ts        # ww astro
|   |   +-- tui.ts          # ww tui
|   |   +-- serve.ts        # ww serve
|   |   +-- schedule.ts     # ww schedule
|   |   +-- convert.ts      # ww convert
|   |   +-- dst.ts          # ww dst
|   |   +-- proxy.ts        # ww proxy
|   +-- lib/
|   |   +-- wristworks.ts   # wristworks npm module wrapper
|   |   +-- ipgeo.ts        # IpGeolocationClient wrapper
|   |   +-- llm.ts          # LLM engine (Ollama / OpenAI / Anthropic)
|   |   +-- formatter.ts    # Output formatting
|   +-- tui/
|       +-- dashboard.tsx   # React/Ink TUI components
|       +-- components/     # Grid, header, footer widgets
+-- wristworks.yaml          # Config (same as wristworks)
+-- package.json
+-- tsconfig.json
```

---

## LLM Engine Design

```typescript
interface LlmConfig {
  provider: 'ollama' | 'openai' | 'anthropic' | 'none'
  model?: string
  apiKey?: string
  baseUrl?: string
}

interface TimeContext {
  locations: TimeResult[]
  calibration: CalibrationBlock
  proxy?: ProxyOutput
}

// LLM receives time context as system prompt + function definitions
// Example tool: get_timezone_info(timezone: string) => TimeResult
// Example tool: find_overlap(timezones: string[], duration: number) => Overlap[]
// Example tool: convert_time(time: string, from: string, to: string) => string
```

The LLM never guesses time offsets — it always calls tools backed by wristworks' Rust NTP core.

---

## Roadmap Integration

| Phase | Feature | Depends on |
|-------|---------|-----------|
| 0.2 | ipgeo client + enriched proxy | ipgeo-cli Phase 3 |
| 0.3 | `ww ask` with Ollama | Phase 0.2 |
| 0.4 | `ww tui` dashboard | wristworks WS server |
| 0.5 | `ww schedule` meeting finder | Phase 0.3 |
| 0.6 | `ww astro` + sunrise calendar | ipgeo astronomy API |
| 1.0 | Full release | All above |
