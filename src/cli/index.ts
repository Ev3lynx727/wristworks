#!/usr/bin/env node
import { Wristworks, multiConvert, lookupIpWithLocation, probeHttp, dnsDig } from '../core/index.js'
import type { MultiConvertRequest, WristworksConfig } from '../core/types.js'
import { formatCurrencyRate } from '../core/constants.js'
import { cacheGet } from '../core/cache.js'
import { loadConfig } from '../core/config.js'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { resolve4 } from 'node:dns/promises'
import { AsciiTable3 } from 'ascii-table3'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
function dayName(iso: string): string {
  return DAYS[new Date(iso).getDay()]
}

const RED = '\x1b[31m'
const GREEN = '\x1b[32m'
const YELLOW = '\x1b[33m'
const CYAN = '\x1b[36m'
const BOLD = '\x1b[1m'
const DIM = '\x1b[2m'
const RESET = '\x1b[0m'

function up(s: string): string { return GREEN + '\u25B2 ' + s + RESET }
function down(s: string): string { return RED + '\u25BC ' + s + RESET }
function flat(s: string): string { return DIM + '\u2014 ' + s + RESET }
function tag(t: string, s: string): string { return DIM + '[' + t + ']' + RESET + ' ' + s }

interface RateSnapshot {
  timestamp: string
  rates: Record<string, number>
}

function loadLastRates(): RateSnapshot | null {
  const path = homedir() + '/.local/state/wristworks/last-rates.json'
  try {
    return JSON.parse(readFileSync(path, 'utf-8'))
  } catch {
    return null
  }
}

function saveLastRates(rates: Record<string, number>): void {
  const dir = homedir() + '/.local/state/wristworks'
  const path = dir + '/last-rates.json'
  try {
    mkdirSync(dir, { recursive: true })
  } catch {}
  writeFileSync(path, JSON.stringify({ timestamp: new Date().toISOString(), rates }))
}

function ageFromNow(ts: number): string {
  const sec = Math.floor((Date.now() - ts) / 1000)
  if (sec < 60) return sec + 's'
  if (sec < 3600) return Math.floor(sec / 60) + 'm'
  if (sec < 86400) return Math.floor(sec / 3600) + 'h'
  return Math.floor(sec / 86400) + 'd'
}

function printDebug(prev: RateSnapshot | null, currentRates: Record<string, number>): number {
  let n = 0
  const ntp = cacheGet<Record<string, unknown>>('ntp:calibration')
  const ntpAge = ntp?.ts !== undefined ? ageFromNow(ntp.ts) : '-'
  const ntpStatus = ntp
    ? (ntp.fresh ? GREEN + 'FRESH' + RESET : YELLOW + 'STALE' + RESET)
    : RED + 'MISS' + RESET
  n++; console.log(CYAN + BOLD + '  \u25B6 Debug' + RESET)
  n++; console.log(tag('NTP', 'cache=' + ntpStatus + DIM + '  age=' + ntpAge + '  key=ntp:calibration' + RESET))

  const fx = cacheGet<{ source: string }>('rates:USD')
  const fxAge = fx?.ts !== undefined ? ageFromNow(fx.ts) : '-'
  const fxSrc = fx?.value?.source ?? '-'
  const fxStatus = fx
    ? (fx.fresh ? GREEN + 'FRESH' + RESET : YELLOW + 'STALE' + RESET)
    : RED + 'MISS' + RESET
  n++; console.log(tag('FX', 'cache=' + fxStatus + DIM + '  age=' + fxAge + '  source=' + fxSrc + '  key=rates:USD' + RESET))

  const last = prev?.timestamp
    ? ageFromNow(new Date(prev.timestamp).getTime()) + ' ago'
    : 'never'
  n++; console.log(tag('ARROW', DIM + 'file=last-rates.json  age=' + last + RESET))

  if (currentRates && prev?.rates) {
    const changed = Object.keys(currentRates).filter(k => {
      const p = prev.rates[k]
      return p !== undefined && p !== currentRates[k]
    })
    const unchanged = Object.keys(currentRates).filter(k => {
      const p = prev.rates[k]
      return p !== undefined && p === currentRates[k]
    })
    if (changed.length) { n++; console.log(tag('CHG', DIM + changed.join(', ') + RESET + '  ' + GREEN + '\u25B2\u25BC' + RESET)) }
    if (unchanged.length) { n++; console.log(tag('FLAT', DIM + unchanged.join(', ') + '  \u2014' + RESET)) }
  }
  n++; console.log()
  return n
}

function renderDashboard(
  out: Awaited<ReturnType<Wristworks['run']>>,
  prev: RateSnapshot | null,
  tickNum: number,
): number {
  const cal = out.calibration
  const synced = cal.servers.filter(s => s.status === 'synchronized')
  const medianDrift = synced.length > 0
    ? synced.map(s => s.driftMs).sort((a, b) => a - b)[Math.floor(synced.length / 2)]
    : 0

  const table = new AsciiTable3()
    .setStyle('ascii-clean')
    .setHeading('Ticker', 'Rate', 'Change', 'Timezone', 'Day', 'Local', 'Offset', 'DST')
    .setAlignRight(1)
    .setAlignRight(2)

  for (const loc of out.locations) {
    const ticker = loc.currency?.code || '\u2014'
    const rate = loc.currency
      ? formatCurrencyRate(loc.currency.code, loc.currency.rate)
      : ''

    let change: string
    if (loc.currency && prev?.rates) {
      const prevRate = prev.rates[loc.currency.code]
      if (prevRate !== undefined && prevRate !== loc.currency.rate) {
        const rawDiff = (loc.currency.rate - prevRate) / prevRate * 100
        const diff = rawDiff.toFixed(3)
        if (Math.abs(rawDiff) < 0.0005) {
          change = flat('0.000%')
        } else {
          const pct = (rawDiff >= 0 ? '+' : '') + diff + '%'
          change = rawDiff > 0 ? up(pct) : down(pct)
        }
      } else {
        change = flat('0.000%')
      }
    } else {
      change = flat('-')
    }

    const tz = loc.timezone.substring(0, 20) + ' (' + loc.label + ')'
    const day = dayName(loc.datetime)
    const time = loc.datetime.slice(11, 16)
    const offset = loc.offset
    const dst = loc.dstActive ? GREEN + '\u2600' + RESET : DIM + '\u2013' + RESET

    table.addRow(ticker, rate, change, tz, day, time, offset, dst)
  }

  const tickLabel = tickNum > 0 ? `  Tick #${tickNum}` : ''
  let lines = 0
  lines++; console.log(BOLD + 'WRISTWORKS v' + out.audit.version + RESET + DIM + '  \u2014  Bloomberg Terminal Mode' + tickLabel + RESET)
  lines++; console.log(DIM + 'NTP: ' + cal.method + ' (' + cal.polls + ' polls, median ' + medianDrift + 'ms drift)' + RESET)
  const best = synced[0]
  if (best) { lines++; console.log(DIM + 'Ref: ' + best.host + ' (stratum ' + best.stratum + ')  |  Drift: ~' + medianDrift + 'ms' + RESET) }
  if (out.proxy) { lines++; console.log(DIM + 'Proxy: ' + (out.proxy.proxies[0]?.proxy || 'direct') + RESET) }
  lines++; console.log()
  const tableStr = table.toString()
  lines += tableStr.split('\n').length
  console.log(tableStr)
  lines++; console.log()
  const lastSync = best?.lastSync
    ? new Date(best.lastSync).toLocaleTimeString()
    : null
  const lastRates = prev?.timestamp
    ? new Date(prev.timestamp).toLocaleTimeString()
    : null
  const nextSync = new Date(out.audit.nextSync).toLocaleTimeString()

  let footer: string
  if (lastSync && lastRates && lastSync === lastRates) {
    footer = 'Last sync/rates: ' + lastSync
  } else if (lastSync && lastRates) {
    footer = 'Last sync: ' + lastSync + '  |  Last rates: ' + lastRates
  } else {
    footer = 'Last sync: ' + (lastSync ?? '-') + '  |  Last rates: ' + (lastRates ?? '-')
  }
  footer += '  |  Next sync: ' + nextSync
  console.log(DIM + footer + RESET)
  lines++
  return lines
}

function resolveConversions(
  triples: string[],
  cfg: WristworksConfig,
  flags: { from?: string; to?: string; amount?: number },
): MultiConvertRequest[] {
  const baseTarget = cfg.currency?.base ?? 'USD'
  const defaultAmount = flags.amount !== undefined && !isNaN(flags.amount) ? flags.amount : 1

  if (triples.length > 0) {
    const convs: MultiConvertRequest[] = []
    for (let i = 0; i < triples.length; i += 3) {
      const amount = parseFloat(triples[i])
      if (isNaN(amount)) { console.error('Invalid amount:', triples[i]); process.exit(1) }
      convs.push({ amount, from: triples[i + 1].toUpperCase(), to: triples[i + 2].toUpperCase() })
    }
    return convs
  }

  if (flags.from) {
    const to = (flags.to ?? baseTarget).toUpperCase()
    return flags.from.split(',').map(f => ({ amount: defaultAmount, from: f.trim().toUpperCase(), to }))
  }

  return []
}

async function cmdConvert(args: string[], cfg: WristworksConfig): Promise<void> {
  const nonFlag = args.filter(a => !a.startsWith('-'))
  const jsonMode = args.includes('--json') || args.includes('-j')
  const listMode = args.includes('--list')
  const configMode = args.includes('--config')
  const hasFrom = args.includes('--from')
  const fromFlag = args.find(a => a.startsWith('--from='))?.split('=', 2)[1]
    ?? (hasFrom ? args[args.indexOf('--from') + 1] : undefined)
  const hasTo = args.includes('--to')
  const toFlag = args.find(a => a.startsWith('--to='))?.split('=', 2)[1]
    ?? (hasTo ? args[args.indexOf('--to') + 1] : undefined)
  const amountFlag = parseFloat(
    args.find(a => a.startsWith('--amount='))?.split('=', 2)[1]
    ?? (args.includes('--amount') ? args[args.indexOf('--amount') + 1] : 'NaN'),
  )

  if (listMode) {
    const presets = cfg.currency?.conversions ?? []
    if (presets.length === 0) {
      console.log('No conversion presets configured in wristworks.yaml')
      return
    }
    const base = cfg.currency?.base ?? 'USD'
    const table = new AsciiTable3()
      .setStyle('ascii-clean')
      .setHeading('Amount', 'From', '', 'To')
      .setAlignRight(0)
    for (const p of presets) {
      const to = (p.to ?? base).toUpperCase()
      table.addRow(p.amount, p.from.toUpperCase(), DIM + '\u2192' + RESET, to)
    }
    console.log('Configured conversion presets:')
    console.log(table.toString())
    return
  }

  if (configMode) {
    const presets = cfg.currency?.conversions ?? []
    if (presets.length === 0) {
      console.error('No conversion presets configured in wristworks.yaml currency.conversions')
      process.exit(1)
    }
    const base = cfg.currency?.base ?? 'USD'
    const conversions: MultiConvertRequest[] = presets.map(p => ({
      amount: p.amount,
      from: p.from.toUpperCase(),
      to: (p.to ?? base).toUpperCase(),
    }))
    try {
      const results = await multiConvert(conversions)
      printConvertResults(results, jsonMode)
    } catch (err) {
      console.error('Conversion failed:', err instanceof Error ? err.message : err)
      process.exit(1)
    }
    return
  }

  const hasTriples = !hasFrom && nonFlag.length > 0
  const conversions = hasTriples
    ? resolveConversions(nonFlag, cfg, { from: undefined, to: undefined, amount: undefined })
    : resolveConversions([], cfg, { from: fromFlag, to: toFlag, amount: amountFlag })

  if (conversions.length === 0) {
    console.error('Usage: ww convert <amount> <from> <to> [<amount> <from> <to> ...]')
    console.error('  ww convert 1 USD IDR')
    console.error('  ww convert 1 USD IDR 1 TWD IDR 1 JPY IDR')
    console.error('  ww convert --from USD,TWD,JPY --to IDR')
    console.error('  ww convert --config')
    console.error('  ww convert --list')
    process.exit(1)
  }

  try {
    const results = await multiConvert(conversions)
    printConvertResults(results, jsonMode)
  } catch (err) {
    console.error('Conversion failed:', err instanceof Error ? err.message : err)
    process.exit(1)
  }
}

function printConvertResults(results: Awaited<ReturnType<typeof multiConvert>>, json: boolean): void {
  if (json) {
    console.log(JSON.stringify(results, null, 2))
    return
  }
  const table = new AsciiTable3()
    .setStyle('ascii-clean')
    .setHeading('From', 'Amount', '', 'To', 'Amount', 'Rate', 'Source')
    .setAlignRight(1).setAlignRight(4)
  for (const r of results) {
    const staleLabel = r.stale ? DIM + ' (stale)' + RESET : ''
    table.addRow(
      r.from.currency,
      r.from.amount,
      DIM + '\u2192' + RESET,
      r.to.currency,
      r.to.amount,
      r.rate,
      r.source + staleLabel,
    )
  }
  console.log(table.toString())
}

async function cmdAsk(args: string[]): Promise<void> {
  const jsonMode = args.includes('--json') || args.includes('-j')
  const prompt = args.filter(a => !a.startsWith('-')).join(' ')

  if (!prompt) {
    if (jsonMode) {
      console.log(JSON.stringify({ command: 'ask', status: 'no_prompt', message: 'Please provide a question.' }))
    } else {
      console.log(BOLD + 'ww ask' + RESET + '  \u2014  ' + DIM + 'AI-powered timezone assistant' + RESET)
      console.log()
      console.log(DIM + '  Usage: ww ask <your question> (requires feat/wristworks-ai-dev branch)' + RESET)
    }
    return
  }

  const msg = 'ww ask requires the feat/wristworks-ai-dev branch (git checkout feat/wristworks-ai-dev)'
  if (jsonMode) {
    console.log(JSON.stringify({ command: 'ask', status: 'unavailable', prompt, message: msg }, null, 2))
  } else {
    console.log(DIM + msg + RESET)
  }
}

interface ServerCatchEntry {
  name: string
  host: string
  ip: string
  location: string
  timezone: string
  datetime: string
  offset: string
  dstActive: boolean
  day: string
  provider?: string
  server?: string
  statusCode?: number
  up?: boolean
  probeLatencyMs?: number
}

function tzTime(tz: string): { datetime: string; offset: string; dstActive: boolean; day: string } {
  const now = new Date()
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric', month: '2-digit', day: '2-digit',
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
  const dstActive = dstJan !== dstJul

  const day = DAYS[now.getDay()]
  return { datetime, offset, dstActive, day }
}

async function cmdServerCatch(args: string[], cfg: WristworksConfig): Promise<void> {
  const jsonMode = args.includes('--json') || args.includes('-j')
  const probeMode = args.includes('--probe') || args.includes('-p')
  const tzIdx = args.indexOf('-t')
  const tzLongIdx = args.indexOf('--timezone')
  const tzVal = (idx: number) => (idx >= 0 && idx + 1 < args.length && !args[idx + 1].startsWith('-')) ? args[idx + 1] : undefined
  const tzFlag = args.find(a => a.startsWith('--timezone='))?.split('=', 2)[1]
    ?? tzVal(tzLongIdx) ?? tzVal(tzIdx)

  const tzValueIndices = new Set<number>()
  if (tzIdx >= 0 && tzIdx + 1 < args.length) tzValueIndices.add(tzIdx + 1)
  if (tzLongIdx >= 0 && tzLongIdx + 1 < args.length) tzValueIndices.add(tzLongIdx + 1)
  const domains = args.filter((a, i) => !a.startsWith('-') && !tzValueIndices.has(i))

  const entries: ServerCatchEntry[] = []

  const configured = cfg.servers ?? []
  for (const sv of configured) {
    let ip = sv.host
    try {
      const addrs = await resolve4(sv.host)
      if (addrs.length > 0) ip = addrs[0]
    } catch {}
    const t = tzTime(sv.timezone)
    entries.push({
      name: sv.name,
      host: sv.host,
      ip,
      location: sv.location,
      timezone: sv.timezone,
      datetime: t.datetime,
      offset: t.offset,
      dstActive: t.dstActive,
      day: t.day,
      provider: sv.provider,
    })
  }

  for (const domain of domains) {
    let ip = domain
    try {
      const addrs = await resolve4(domain)
      if (addrs.length > 0) ip = addrs[0]
    } catch {}
    const geo = await lookupIpWithLocation(domain, ip)
    const tz = tzFlag || geo.timezone
    const t = tzTime(tz)
    entries.push({
      name: domain,
      host: domain,
      ip,
      location: tzFlag || geo.location,
      timezone: tz,
      datetime: t.datetime,
      offset: t.offset,
      dstActive: t.dstActive,
      day: t.day,
      provider: geo.provider,
    })
  }

  if (probeMode) {
    await Promise.all(entries.map(async (e) => {
      const probe = await probeHttp(e.host)
      e.up = probe.up
      e.server = probe.server
      e.statusCode = probe.statusCode
      e.probeLatencyMs = probe.latencyMs
    }))
  }

  if (entries.length === 0) {
    console.error('Usage: ww server-catch [domain...]')
    console.error('  ww server-catch                              # show configured servers')
    console.error('  ww server-catch x.com instagram.com           # ad-hoc domains')
    console.error('  ww server-catch x.com -t Asia/Tokyo           # with timezone hint')
    console.error('  ww server-catch --probe                       # HTTP probe (Server header + status)')
    console.error('  ww server-catch --json                        # JSON output')
    process.exit(1)
  }

  if (jsonMode) {
    console.log(JSON.stringify(entries, null, 2))
    return
  }

  const hasStatus = entries.some(e => e.up !== undefined)
  const hasServer = entries.some(e => e.server !== undefined)

  const table = new AsciiTable3()
    .setStyle('ascii-clean')
  const heading = ['Name', 'Host', 'IP', 'Provider', 'Location', 'Timezone', 'Local', 'Offset', 'DST']
  if (hasServer) heading.splice(5, 0, 'Server')
  if (hasStatus) heading.push('Status')
  heading.push('Day')
  table.setHeading(...heading)

  for (const e of entries) {
    const dst = e.dstActive ? GREEN + '\u2600' + RESET : DIM + '\u2013' + RESET
    const prov = e.provider || DIM + '\u2014' + RESET
    const status = e.up === undefined ? ''
      : e.up
        ? (e.statusCode ? GREEN + '\u25CF' + RESET + ' ' + e.statusCode : GREEN + '\u25CF' + RESET)
        : RED + '\u25CF ' + (e.probeLatencyMs ? e.probeLatencyMs + 'ms' : '') + RESET
    const server = e.server || DIM + '\u2014' + RESET
    const row = [e.name, e.host, e.ip, prov, e.location, e.timezone, e.datetime.slice(11, 19), e.offset, dst]
    if (hasServer) row.splice(4, 0, server)
    if (hasStatus) row.push(status)
    row.push(e.day)
    table.addRow(...row)
  }
  console.log(table.toString())
}

async function cmdServerFetch(args: string[]): Promise<void> {
  const jsonMode = args.includes('--json') || args.includes('-j')
  const probeMode = args.includes('--probe') || args.includes('-p')

  const domains = args.filter(a => !a.startsWith('-'))

  if (domains.length === 0) {
    console.error('Usage: ww server-fetch <domain...> [--probe] [--json]')
    console.error('  ww server-fetch x.com github.io')
    console.error('  ww server-fetch x.com --probe       # with HTTP probe')
    console.error('  ww server-fetch --json               # JSON output')
    process.exit(1)
  }

  const results = await Promise.all(domains.map(d => dnsDig(d, { probe: probeMode })))

  if (jsonMode) {
    console.log(JSON.stringify(results, null, 2))
    return
  }

  for (const r of results) {
    const ipStr = r.ips.length > 0 ? r.ips.join(', ') : DIM + 'unresolved' + RESET
    const statusStr = r.up === undefined ? '' : r.up ? GREEN + '\u25CF UP' + RESET : RED + '\u25CF DOWN' + RESET
    console.log(BOLD + r.domain + RESET + '  \u2192  ' + ipStr + (r.lookupTimeMs ? DIM + '  (' + r.lookupTimeMs + 'ms)' + RESET : ''))
    if (r.location) console.log('  ' + YELLOW + '\u25B6' + RESET + '  Location: ' + r.location + DIM + '  ' + r.timezone + '  provider=' + (r.provider || '\u2014') + RESET)
    if (statusStr) console.log('  ' + statusStr + (r.server ? DIM + '  server=' + r.server + RESET : '') + (r.statusCode ? DIM + '  status=' + r.statusCode + RESET : '') + (r.probeLatencyMs ? DIM + '  ' + r.probeLatencyMs + 'ms' + RESET : ''))
    for (const rec of r.records) {
      console.log('  ' + DIM + rec.type.padEnd(6) + RESET + ' ' + rec.value)
    }
    console.log()
  }
}

async function main() {
  const args = process.argv.slice(2)
  const subcommand = args[0]

  if (subcommand === 'convert') {
    const cfg = loadConfig()
    return cmdConvert(args.slice(1), cfg)
  }

  if (subcommand === 'ask') {
    return cmdAsk(args.slice(1))
  }

  if (subcommand === 'server-catch') {
    const cfg = loadConfig()
    return cmdServerCatch(args.slice(1), cfg)
  }

  if (subcommand === 'server-fetch') {
    return cmdServerFetch(args.slice(1))
  }

  const configPath = args.find(
    a => !a.startsWith('-') && a !== '--watch' && a !== '-w' && a !== '--json' && a !== '-j' && a !== '--debug' && a !== '-d' && a !== 'server-catch' && a !== 'server-fetch',
  ) || './wristworks.yaml'

  const jsonMode = args.includes('--json') || args.includes('-j')
  const debugMode = args.includes('--debug') || args.includes('-d')
  const watchMode = args.includes('--watch') || args.includes('-w')

  const ww = new Wristworks({ configPath })
  let prev = loadLastRates()
  let tickNum = 0
  let lastTotalLines = 0

  async function tick(): Promise<void> {
    process.stderr.write(tickNum === 0 ? 'Calibrating via NTP...\n' : '')
    const out = await ww.run()
    tickNum++

    if (jsonMode) {
      console.log(JSON.stringify(out, null, 2))
      if (!watchMode) return
      return
    }

    const currentRates: Record<string, number> = {}
    for (const loc of out.locations) {
      if (loc.currency) {
        const key = loc.currency.code
        if (!(key in currentRates)) currentRates[key] = loc.currency.rate
      }
    }
    if (Object.keys(currentRates).length > 0) saveLastRates(currentRates)

    if (tickNum > 1) {
      process.stdout.write('\x1b[' + lastTotalLines + 'A\x1b[J')
    }

    let totalLines = 0
    if (debugMode) totalLines += printDebug(prev, currentRates)
    totalLines += renderDashboard(out, prev, tickNum)
    lastTotalLines = totalLines

    prev = loadLastRates()

    if (watchMode) {
      setTimeout(tick, 60000)
    }
  }

  await tick()
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
