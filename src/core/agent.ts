import { Wristworks, multiConvert } from './index.js'
import { lookupIpWithLocation } from './geo.js'
import { loadConfig } from './config.js'

const cfg = loadConfig().agent
const OLLAMA_URL = (cfg?.ollamaUrl || 'http://localhost:11434') + '/api/chat'
const MODEL = cfg?.model || 'qwen2.5:3b'
const MAX_STEPS = cfg?.maxSteps ?? 8

const TZ_ALIASES: Record<string, string> = {
  indo: 'Asia/Jakarta', indonesia: 'Asia/Jakarta', jakarta: 'Asia/Jakarta',
  jkt: 'Asia/Jakarta', bali: 'Asia/Makassar', wita: 'Asia/Makassar',
  wit: 'Asia/Jayapura', japan: 'Asia/Tokyo', tokyo: 'Asia/Tokyo',
  korea: 'Asia/Seoul', seoul: 'Asia/Seoul', singapore: 'Asia/Singapore',
  sg: 'Asia/Singapore', china: 'Asia/Shanghai', shanghai: 'Asia/Shanghai',
  beijing: 'Asia/Shanghai', taiwan: 'Asia/Taipei', taipei: 'Asia/Taipei',
  hongkong: 'Asia/Hong_Kong', hk: 'Asia/Hong_Kong', macau: 'Asia/Macau',
  india: 'Asia/Kolkata', mumbai: 'Asia/Kolkata', delhi: 'Asia/Kolkata',
  thailand: 'Asia/Bangkok', bangkok: 'Asia/Bangkok', vietnam: 'Asia/Ho_Chi_Minh',
  philippines: 'Asia/Manila', manila: 'Asia/Manila', malaysia: 'Asia/Kuala_Lumpur',
  kl: 'Asia/Kuala_Lumpur', myanmar: 'Asia/Yangon', cambodia: 'Asia/Phnom_Penh',
  laos: 'Asia/Vientiane', brunei: 'Asia/Brunei', mongolia: 'Asia/Ulaanbaatar',
  uk: 'Europe/London', london: 'Europe/London', england: 'Europe/London',
  moscow: 'Europe/Moscow', russia: 'Europe/Moscow', turkey: 'Europe/Istanbul',
  istanbul: 'Europe/Istanbul', dubai: 'Asia/Dubai', uae: 'Asia/Dubai',
  mecca: 'Asia/Riyadh', saudi: 'Asia/Riyadh', australia: 'Australia/Sydney',
  sydney: 'Australia/Sydney', melbourne: 'Australia/Sydney',
  newzealand: 'Pacific/Auckland', auckland: 'Pacific/Auckland',
  ny: 'America/New_York', newyork: 'America/New_York', 'new york': 'America/New_York',
  chicago: 'America/Chicago', la: 'America/Los_Angeles', 'los angeles': 'America/Los_Angeles',
  hawaii: 'Pacific/Honolulu', denver: 'America/Denver',
  paris: 'Europe/Paris', berlin: 'Europe/Berlin', rome: 'Europe/Rome',
  madrid: 'Europe/Madrid', amsterdam: 'Europe/Amsterdam',
}

const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'get_times',
      description: 'Get current local times for all 27 configured timezone locations with currency rates. Returns each location: datetime, GMT offset, DST, day, currency rate.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'convert',
      description: 'Convert between any two ISO 4217 currency codes using live rates. Supports USD, IDR, JPY, KRW, SGD, MYR, THB, VND, PHP, EUR, GBP, AUD, and more.',
      parameters: {
        type: 'object',
        properties: {
          from: { type: 'string', description: 'Source currency code (e.g. USD)' },
          to: { type: 'string', description: 'Target currency code (e.g. IDR)' },
          amount: { type: 'number', description: 'Amount to convert (default 1)' },
        },
        required: ['from', 'to'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'server_catch',
      description: 'Resolve any domain to IP and discover location, timezone, and hosting provider. Returns: IP, country, timezone, city, provider (ASN/ISP).',
      parameters: {
        type: 'object',
        properties: {
          domains: { type: 'array', items: { type: 'string' }, description: 'Domain names to look up' },
        },
        required: ['domains'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_everything',
      description: 'Get a comprehensive global snapshot: all timezone locations with current local times, real-time currency rates for all configured targets, NTP calibration status (drift, latency per server), and proxy/VPN info. One call gives you the full picture.',
      parameters: { type: 'object', properties: {} },
    },
  },
]

function buildSystemPrompt(): string {
  const now = new Date()
  const targets = loadConfig().targets?.filter(t => t.enabled) || []
  const targetLines = targets.map(t => {
    const alias = Object.entries(TZ_ALIASES).find(([, v]) => v === t.timezone)
    return `  ${t.name.padEnd(18)} ${t.timezone.padEnd(24)} ${t.label}${alias ? `  (alias: ${alias[0]})` : ''}`
  }).join('\n')
  const weekday = now.toLocaleDateString('en', { weekday: 'long' })
  return [
    'You are wristworks-ai, a timezone intelligence assistant.',
    `Current UTC: ${now.toISOString().replace('T', ' ').slice(0, 19)} (${weekday})`,
    '',
    `CONFIGURED TARGETS (${targets.length} locations):`,
    targetLines,
    '',
    'RULES:',
    '1. Always use a tool to get live data before answering',
    '2. Best social media posting: 9-11am and 1-3pm in AUDIENCE timezone (Tue-Thu best)',
    '3. Convert audience windows to user locale by comparing GMT offsets',
    '4. For cities not in target list, use server_catch to resolve them',
    '5. Show reasoning and cite which tool provided the data',
    '',
    'COMMON ALIASES (city/country -> timezone):',
    ...Object.entries(TZ_ALIASES).slice(0, 25).map(([k, v]) => `  ${k.padEnd(16)} ${v}`),
  ].join('\n')
}

interface ToolCall {
  function: { name: string; arguments: string }
}

interface OllamaMsg {
  role: string
  content: string
  tool_calls?: ToolCall[]
  name?: string
}

interface OllamaResp {
  message?: OllamaMsg
}

async function callOllama(messages: OllamaMsg[]): Promise<OllamaResp> {
  const body = JSON.stringify({ model: MODEL, messages, tools: TOOLS, stream: false })
  const res = await fetch(OLLAMA_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  })
  if (!res.ok) throw new Error(`Ollama API error: ${res.status} ${res.statusText}`)
  return res.json() as Promise<OllamaResp>
}

async function executeTool(name: string, args: Record<string, unknown>): Promise<string> {
  switch (name) {
    case 'get_times': {
      const ww = new Wristworks()
      const out = await ww.run()
      const rows = out.locations.map(l => {
        const c = l.currency ? ` ${l.currency.code}=${l.currency.rate.toFixed(4)}` : ''
        return `  ${l.name.padEnd(16)} ${l.datetime}  offset=${l.offset}  DST=${l.dstActive}  day=${l.label}${c}`
      }).join('\n')
      return `Current times (drift=${out.calibration.servers.map(s => s.driftMs + 'ms').join(', ')}):\n${rows}`
    }
    case 'convert': {
      const from = String(args.from ?? 'USD').toUpperCase()
      const to = String(args.to ?? 'IDR').toUpperCase()
      const amount = typeof args.amount === 'number' ? args.amount : 1
      const results = await multiConvert([{ amount, from, to }])
      const r = results[0]
      if (!r) return 'Conversion failed'
      return `${amount} ${from} = ${r.to.amount} ${to}\nRate: ${r.rate} (source: ${r.source}, ${r.timestamp})`
    }
    case 'server_catch': {
      const domains = (args.domains as string[]) || []
      const lines: string[] = []
      for (const d of domains) {
        const { resolve4 } = await import('node:dns/promises')
        let ip = d
        try { const a = await resolve4(d); if (a.length > 0) ip = a[0] } catch {}
        const geo = await lookupIpWithLocation(d, ip)
        lines.push(`  ${d} -> ${ip}  ${geo.location}  ${geo.timezone}  provider=${geo.provider || '—'}`)
      }
      return lines.join('\n')
    }
    case 'get_everything': {
      const ww = new Wristworks()
      const out = await ww.run()
      const sections: string[] = []

      sections.push('=== NTP CALIBRATION ===')
      sections.push(`Method: ${out.calibration.method} | Polls: ${out.calibration.polls} | Interval: ${out.calibration.pollIntervalMs}ms`)
      for (const s of out.calibration.servers) {
        sections.push(`  ${s.host}  drift=${s.driftMs}ms  latency=${s.latencyMs}ms  jitter=${s.jitterMs ?? '—'}ms  stratum=${s.stratum}  status=${s.status}  loss=${s.packetLoss}%`)
      }

      sections.push('')
      sections.push('=== LOCATIONS & CURRENCY ===')
      for (const l of out.locations) {
        const c = l.currency ? `  ${l.currency.code}=${l.currency.rate.toFixed(4)}` : ''
        sections.push(`  ${l.name.padEnd(18)} ${l.datetime}  ${l.offset}  DST=${l.dstActive}  ${l.label}${c}`)
      }

      sections.push('')
      sections.push('=== CONFIGURED SERVERS ===')
      const svCfg = loadConfig().servers || []
      if (svCfg.length > 0) {
        for (const sv of svCfg) {
          sections.push(`  ${sv.name.padEnd(12)} ${sv.host}  ${sv.location}  ${sv.timezone}${sv.provider ? `  provider=${sv.provider}` : ''}`)
        }
      } else {
        sections.push('  (none configured)')
      }

      if (out.proxy) {
        sections.push('')
        sections.push('=== PROXY / VPN ===')
        if (out.proxy.vpn.active) sections.push(`  VPN: ${out.proxy.vpn.interface} (${out.proxy.vpn.type})`)
        if (out.proxy.proxies.length > 0) {
          for (const p of out.proxy.proxies) {
            sections.push(`  ${p.protocol}://${p.ip}:${p.port}  ${p.geolocation.country}  score=${p.score}`)
          }
        }
      }

      sections.push('')
      sections.push(`Generated: ${out.audit.generatedBy} v${out.audit.version} | Next sync: ${out.audit.nextSync}`)

      return sections.join('\n')
    }
    default:
      return `Unknown tool: ${name}`
  }
}

export interface AgentResult {
  answer: string
  steps: { tool: string; result: string }[]
  model: string
}

function directConvert(prompt: string): string | null {
  const m = prompt.match(/(?:convert\s+)?(\d+(?:\.\d+)?)\s*([A-Za-z]{3,4})\s+(?:to|in|=\s*)\s*([A-Za-z]{3,4})/i)
  if (!m) return null
  return `convert(${m[2].toUpperCase()},${m[3].toUpperCase()},${m[1]})`
}

function directTimeQuery(prompt: string): string | null {
  const timePatterns = [
    /(?:what(?:'s| is) )?(?:the )?(?:current )?time (?:in|at) (.+?)(?:\?|$)/i,
    /what time (?:is it|do you have) (?:in|at) (.+?)(?:\?|$)/i,
    /time in (.+?)(?:\?|$)/i,
  ]
  for (const p of timePatterns) {
    const m = prompt.match(p)
    if (m) return `time(${m[1].trim()})`
  }
  return null
}

async function tryDirectRoute(prompt: string): Promise<{ answer: string; steps: { tool: string; result: string }[] } | null> {
  const conv = directConvert(prompt)
  if (conv) {
    const [, from, to, amount] = conv.match(/convert\((.+),(.+),(.+)\)/)!
    const results = await multiConvert([{ amount: parseFloat(amount), from, to }])
    if (results[0]) {
      const r = results[0]
      const text = `${r.from.amount} ${r.from.currency} = ${r.to.amount} ${r.to.currency} (rate: ${r.rate}, source: ${r.source})`
      return { answer: text, steps: [{ tool: 'convert', result: text }] }
    }
  }

  const tq = directTimeQuery(prompt)
  if (tq) {
    const targets = loadConfig().targets?.filter(t => t.enabled) || []
    const place = tq.match(/time\((.+)\)/)![1].toLowerCase()
    const alias = TZ_ALIASES[place]
    const match = targets.find(t => {
      const name = t.name.toLowerCase().replace(/[^a-z0-9]/g, '')
      const search = place.replace(/[^a-z0-9]/g, '')
      return name === search || name.includes(search) || search.includes(name) ||
        t.timezone.toLowerCase() === place || t.label.toLowerCase() === place ||
        t.city?.toLowerCase() === place || t.countryCode?.toLowerCase() === place
    })
    if (match || alias) {
      const ww = new Wristworks()
      const out = await ww.run()
      const loc = out.locations.find(l =>
        l.name === match?.name || l.timezone === alias
      )
      if (loc) {
        const text = `It's ${loc.datetime} in ${loc.name} (${loc.timezone}, ${loc.offset}, DST=${loc.dstActive})`
        return { answer: text, steps: [{ tool: 'get_times', result: text }] }
      }
    }
  }

  return null
}

export async function ask(prompt: string): Promise<AgentResult> {
  const direct = await tryDirectRoute(prompt)
  if (direct) return { ...direct, model: MODEL }

  const messages: OllamaMsg[] = [
    { role: 'system', content: buildSystemPrompt() },
    { role: 'user', content: prompt },
  ]
  const steps: { tool: string; result: string }[] = []

  for (let i = 0; i < MAX_STEPS; i++) {
    const resp = await callOllama(messages)
    const msg = resp.message
    if (!msg) throw new Error('No response from Ollama')

    if (msg.tool_calls && msg.tool_calls.length > 0) {
      messages.push({ role: 'assistant', content: '', tool_calls: msg.tool_calls })
      for (const tc of msg.tool_calls) {
        const fname = tc.function.name
        const raw = tc.function.arguments
        let args: Record<string, unknown>
        try {
          args = typeof raw === 'string' ? JSON.parse(raw) : raw as Record<string, unknown>
        } catch {
          args = {}
        }
        const result = await executeTool(fname, args)
        steps.push({ tool: fname, result })
        messages.push({ role: 'tool', content: result, name: fname })
      }
      continue
    }

    const answer = msg.content || 'No answer generated'
    return { answer, steps, model: MODEL }
  }

  return { answer: 'Max steps reached without final answer', steps, model: MODEL }
}
