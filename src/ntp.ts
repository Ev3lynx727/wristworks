import { createRequire } from 'node:module'
import { resolve4 } from 'node:dns/promises'
import { NTPClient } from 'ntpclient'
import type { NtpConfig, NtpServerResult, CalibrationBlock } from './types.js'

const _require = createRequire(import.meta.url)
let native: any
try {
  native = _require('../native/index.cjs')
} catch {
}

function mapNative(r: any): NtpServerResult {
  return {
    host: r.host,
    ip: r.ip || '',
    latencyMs: r.latencyMs,
    jitterMs: r.jitterMs ?? null,
    packetLoss: r.packetLoss,
    driftMs: r.driftMs,
    status: r.status,
    stratum: r.stratum,
    lastSync: r.lastSync ?? null,
    error: r.error || undefined,
  }
}

async function pollOnce(servers: string[], timeoutMs: number): Promise<NtpServerResult[]> {
  if (native) {
    try {
      const raw: any[] = native.calibrateNtp(servers)
      return raw.map(mapNative)
    } catch (err) {
      console.warn(`[wristworks] native NTP failed (${err}), falling back to TS`)
    }
  }

  const results: NtpServerResult[] = []

  for (const server of servers) {
    let ip = ''
    try {
      const addrs = await resolve4(server)
      ip = addrs[0] || ''
    } catch {
    }

    try {
      const client = new NTPClient({ server, replyTimeout: timeoutMs })
      const before = Date.now()
      const ntpTime = await client.getNetworkTime()
      const after = Date.now()
      const rtt = after - before
      const driftMs = ntpTime.getTime() - Date.now()
      results.push({
        host: server,
        ip,
        latencyMs: rtt,
        jitterMs: Math.max(1, Math.round(rtt / 20)),
        packetLoss: 0,
        driftMs,
        status: 'synchronized',
        stratum: 0,
        lastSync: new Date().toISOString(),
      })
    } catch (err) {
      results.push({
        host: server,
        ip,
        latencyMs: 0,
        jitterMs: null,
        packetLoss: 100,
        driftMs: 0,
        status: 'failed',
        stratum: 0,
        lastSync: null,
        error: String(err),
      })
    }
  }

  return results
}

function medianSorted(arr: number[]): number {
  if (arr.length === 0) return 0
  const mid = Math.floor(arr.length / 2)
  return arr.length % 2 === 0
    ? Math.round((arr[mid - 1] + arr[mid]) / 2)
    : arr[mid]
}

function aggregatePolls(polls: NtpServerResult[][]): NtpServerResult[] {
  if (polls.length === 0) return []
  const serverCount = polls[0].length

  return Array.from({ length: serverCount }, (_, idx) => {
    const entries = polls.map(p => p[idx])
    const successes = entries.filter(e => e.status === 'synchronized')
    const failures = entries.filter(e => e.status !== 'synchronized')

    if (successes.length === 0) {
      return entries[entries.length - 1]
    }

    const drifts = successes.map(e => e.driftMs).sort((a, b) => a - b)
    const latencies = successes.map(e => e.latencyMs).sort((a, b) => a - b)
    const jitters = successes.map(e => e.jitterMs ?? 0).sort((a, b) => a - b)
    const strata = successes.map(e => e.stratum).sort((a, b) => a - b)

    const lastSync = successes.reduce((latest, e) =>
      e.lastSync && (!latest || e.lastSync > latest) ? e.lastSync : latest,
      null as string | null,
    )

    return {
      host: successes[0].host,
      ip: successes[0].ip,
      latencyMs: medianSorted(latencies),
      jitterMs: medianSorted(jitters),
      packetLoss: Math.round((failures.length / entries.length) * 100),
      driftMs: medianSorted(drifts),
      status: 'synchronized',
      stratum: strata[0],
      lastSync,
    }
  })
}

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms))
}

export async function calibrateNtp(config: NtpConfig): Promise<CalibrationBlock> {
  const rawPolls: NtpServerResult[][] = []

  for (let i = 0; i < config.polls; i++) {
    if (i > 0) await sleep(config.pollIntervalMs)
    const results = await pollOnce(config.servers, config.timeoutMs)
    rawPolls.push(results)
  }

  const servers = aggregatePolls(rawPolls)
  return { method: 'NTP', polls: config.polls, pollIntervalMs: config.pollIntervalMs, servers }
}
