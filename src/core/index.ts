export { loadConfig } from './config.js'
export { lookupIp, lookupIpWithLocation } from './geo.js'
export { probeHttp } from './probe.js'
export { calibrateNtp } from './ntp.js'
export { fetchTimes } from './fetcher.js'
export { fetchRates, convertCurrency, multiConvert, unifiedCurrency, enrichLocations, clearCurrencyCache } from './currency.js'
export { cacheGet, cacheSet, cacheClear } from './cache.js'
export type {
  WristworksConfig, Target, NtpConfig,
  TimeResult, Coordinates, CurrencyInfo,
  NtpServerResult, CalibrationBlock,
  Audit, WristworksOutput, ProxyInfo,
  CurrencyConfig, CurrencyRates, CurrencyConversion,
  ConversionPreset, MultiConvertRequest, MultiConvertResult,
  UnifiedCurrencyOptions, UnifiedCurrencySnapshot,
} from './types.js'

import { readFileSync } from 'node:fs'
import { loadConfig } from './config.js'
import { calibrateNtp } from './ntp.js'
import { fetchTimes } from './fetcher.js'
import { buildProxyOutput } from './proxy.js'
import { enrichLocations } from './currency.js'
import { cacheGet, cacheSet } from './cache.js'
import type {
  CalibrationBlock, Audit, WristworksOutput,
} from './types.js'

export interface WristworksOptions {
  configPath?: string
}

function loadVersion(): string {
  try {
    const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf-8'))
    return pkg.version || '0.0.0'
  } catch {
    return '0.0.0'
  }
}

export class Wristworks {
  private config
  private drift = 0
  private lastCalibration: CalibrationBlock | null = null
  private readonly version: string

  constructor(opts?: WristworksOptions) {
    this.config = loadConfig(opts?.configPath)
    this.version = loadVersion()
  }

  async calibrate(): Promise<CalibrationBlock> {
    const cacheKey = 'ntp:calibration'
    const cached = cacheGet<{ block: CalibrationBlock; drift: number }>(cacheKey)
    if (cached && cached.fresh) {
      this.lastCalibration = cached.value.block
      this.drift = cached.value.drift
      return this.lastCalibration
    }

    this.lastCalibration = await calibrateNtp(this.config.ntp)
    const synced = this.lastCalibration.servers.filter(s => s.status === 'synchronized')
    if (synced.length > 0) {
      const median = synced.sort((a, b) => a.driftMs - b.driftMs)
      const mid = Math.floor(median.length / 2)
      this.drift = median.length % 2 === 0
        ? Math.round((median[mid - 1].driftMs + median[mid].driftMs) / 2)
        : median[mid].driftMs
    }

    cacheSet(cacheKey, { block: this.lastCalibration, drift: this.drift }, this.config.ntp.syncIntervalSecs)
    return this.lastCalibration
  }

  fetchAll() {
    const corrected = new Date(Date.now() + this.drift)
    return fetchTimes(this.config.targets, corrected)
  }

  private buildAudit(): Audit {
    const now = new Date()
    const next = new Date(now.getTime() + this.config.ntp.syncIntervalSecs * 1000)
    return {
      generatedBy: 'Copilot-TimeSync',
      version: this.version,
      nextSync: next.toISOString(),
    }
  }

  async run(): Promise<WristworksOutput> {
    const calibration = await this.calibrate()
    const locations = await enrichLocations(this.fetchAll())
    const proxy = buildProxyOutput(this.config.proxy)
    const out: WristworksOutput = { calibration, locations, audit: this.buildAudit() }
    if (proxy) out.proxy = proxy
    return out
  }
}
