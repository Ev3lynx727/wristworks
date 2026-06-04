#!/usr/bin/env node
import { Wristworks } from './index.js'
import { formatCurrencyRate } from './constants.js'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { homedir } from 'node:os'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
function dayName(iso: string): string {
  return DAYS[new Date(iso).getDay()]
}

const RED = '\x1b[31m'
const GREEN = '\x1b[32m'
const BOLD = '\x1b[1m'
const DIM = '\x1b[2m'
const RESET = '\x1b[0m'

function up(s: string): string { return GREEN + '\u25B2 ' + s + RESET }
function down(s: string): string { return RED + '\u25BC ' + s + RESET }
function flat(s: string): string { return DIM + '\u2014 ' + s + RESET }

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

async function main() {
  const args = process.argv.slice(2)
  const jsonMode = args.includes('--json') || args.includes('-j')
  const configPath = args.find(a => !a.startsWith('-')) || './wristworks.yaml'

  const ww = new Wristworks({ configPath })
  process.stderr.write('Calibrating via NTP...\n')
  const out = await ww.run()

  if (jsonMode) {
    console.log(JSON.stringify(out, null, 2))
    return
  }

  const cal = out.calibration
  const synced = cal.servers.filter(s => s.status === 'synchronized')
  const medianDrift = synced.length > 0
    ? synced.map(s => s.driftMs).sort((a, b) => a - b)[Math.floor(synced.length / 2)]
    : 0

  const prev = loadLastRates()

  const currentRates: Record<string, number> = {}
  for (const loc of out.locations) {
    if (loc.currency) {
      const key = loc.currency.code
      if (!(key in currentRates)) currentRates[key] = loc.currency.rate
    }
  }
  if (Object.keys(currentRates).length > 0) saveLastRates(currentRates)

  console.log()
  console.log('  ' + BOLD + 'WRISTWORKS v' + out.audit.version + RESET + DIM + '  \u2014  Bloomberg Terminal Mode' + RESET)
  console.log('  ' + DIM + 'NTP: ' + cal.method + ' (' + cal.polls + ' polls, median ' + medianDrift + 'ms drift)' + RESET)
  const best = synced[0]
  if (best) console.log('  ' + DIM + 'Ref: ' + best.host + ' (stratum ' + best.stratum + ')  |  Drift: ~' + medianDrift + 'ms' + RESET)
  if (out.proxy) console.log('  ' + DIM + 'Proxy: ' + (out.proxy.proxies[0]?.proxy || 'direct') + RESET)
  console.log()

  const hdr =
    BOLD +
    '  Ticker'.padEnd(10) +
    'Rate'.padEnd(16) +
    'Change'.padEnd(12) +
    'Timezone'.padEnd(26) +
    'Day'.padEnd(5) +
    'Local'.padEnd(10) +
    'Offset'.padEnd(10) +
    'DST' +
    RESET
  console.log(hdr)
  console.log(DIM + '  ' + '-'.repeat(84) + RESET)

  for (const loc of out.locations) {
    const ticker = (loc.currency?.code || '\u2014').padEnd(10)
    const rate = loc.currency
      ? formatCurrencyRate(loc.currency.code, loc.currency.rate).padEnd(16)
      : ''.padEnd(16)

    let change: string
    if (loc.currency && prev?.rates) {
      const prevRate = prev.rates[loc.currency.code]
      if (prevRate !== undefined && prevRate !== loc.currency.rate) {
        const diff = ((loc.currency.rate - prevRate) / prevRate * 100).toFixed(3)
        const pct = (diff.startsWith('-') ? '' : '+') + diff + '%'
        if (loc.currency.rate > prevRate) {
          change = up(pct).padEnd(12)
        } else {
          change = down(pct).padEnd(12)
        }
      } else {
        change = flat('0.000%').padEnd(12)
      }
    } else {
      change = flat('-').padEnd(12)
    }

    const tz = (loc.timezone.substring(0, 20) + ' (' + loc.label + ')').padEnd(26)
    const day = dayName(loc.datetime).padEnd(5)
    const time = loc.datetime.slice(11, 16).padEnd(10)
    const offset = loc.offset.padEnd(10)
    const dst = loc.dstActive ? GREEN + '\u2600' + RESET : DIM + '\u2013' + RESET

    console.log('  ' + ticker + rate + change + tz + day + time + offset + dst)
  }

  console.log()
  const lastUpdate = prev?.timestamp
    ? new Date(prev.timestamp).toLocaleTimeString()
    : 'first run'
  console.log(DIM + '  Last rates: ' + lastUpdate + '  |  Next sync: ' + new Date(out.audit.nextSync).toLocaleTimeString() + RESET)
  console.log()
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
