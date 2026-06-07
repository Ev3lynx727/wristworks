import { createRequire } from 'node:module'
import type { Target, TimeResult } from './types.js'

const _require = createRequire(import.meta.url)
let native: Record<string, (...args: unknown[]) => unknown> | undefined
try {
  native = _require('../native/index.cjs')
} catch {
}

const offsetCache = new Map<string, Intl.DateTimeFormatOptions>()

function makeFormatOptions(tz: string): Intl.DateTimeFormatOptions {
  if (!offsetCache.has(tz)) {
    offsetCache.set(tz, {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    })
  }
  return offsetCache.get(tz)!
}

function getTzOffsetMinutes(tz: string, date: Date): number {
  const opts: Intl.DateTimeFormatOptions = {
    timeZone: tz,
    timeZoneName: 'longOffset',
  }
  const raw = new Intl.DateTimeFormat('en-US', opts)
    .formatToParts(date)
    .find(p => p.type === 'timeZoneName')?.value || 'UTC+0'
  const matched = raw.match(/(?:GMT|UTC)([+-]\d+)(?::(\d+))?/)
  if (!matched) return 0
  const h = parseInt(matched[1])
  const m = parseInt(matched[2] || '0')
  return h * 60 + (h < 0 ? -m : m)
}

function offsetMinutesToGmt(offsetMin: number): string {
  const sign = offsetMin < 0 ? '-' : '+'
  const abs = Math.abs(offsetMin)
  const h = Math.floor(abs / 60)
  const m = abs % 60
  return `GMT${sign}${h}${m ? `:${String(m).padStart(2, '0')}` : ''}`
}

function isDstActive(tz: string, date: Date): boolean {
  const jan = getTzOffsetMinutes(tz, new Date(date.getFullYear(), 0, 1))
  const jul = getTzOffsetMinutes(tz, new Date(date.getFullYear(), 6, 1))
  if (jan === jul) return false
  const summer = Math.max(jan, jul)
  const current = getTzOffsetMinutes(tz, date)
  return current === summer
}

function mergeTargetMeta(target: Target, base: TimeResult): TimeResult {
  return {
    ...base,
    countryCode: target.countryCode || '',
    city: target.city || '',
    confidence: target.confidence || 'low',
    coordinates: target.coordinates || null,
  }
}

function buildBase(t: Target, correctedUtc: Date): TimeResult {
  const opts = makeFormatOptions(t.timezone)
  const formatter = new Intl.DateTimeFormat('sv-SE', opts)
  const datetime = formatter.format(correctedUtc)
  const offsetMin = getTzOffsetMinutes(t.timezone, correctedUtc)
  return {
    name: t.name,
    timezone: t.timezone,
    label: t.label,
    datetime,
    epoch: Math.floor(correctedUtc.getTime() / 1000),
    offset: offsetMinutesToGmt(offsetMin),
    dstActive: isDstActive(t.timezone, correctedUtc),
    countryCode: '',
    city: '',
    confidence: '',
    coordinates: null,
  }
}

function fetchTimesTs(targets: Target[], correctedUtc: Date): TimeResult[] {
  return targets
    .filter(t => t.enabled)
    .map(t => mergeTargetMeta(t, buildBase(t, correctedUtc)))
}

function fetchTimesNative(targets: Target[], correctedUtc: Date): TimeResult[] {
  if (!native) return []
  const enabled = targets.filter(t => t.enabled)
  const input = enabled.map(t => ({ name: t.name, timezone: t.timezone, label: t.label }))
  const results = native.formatTimes(correctedUtc.getTime(), input) as Record<string, unknown>[]
  return results.map((r: Record<string, unknown>, i: number) => {
    const t = enabled[i]
    const base = buildBase(t, correctedUtc)
    base.datetime = r.datetime as string
    return mergeTargetMeta(t, base)
  })
}

export function fetchTimes(targets: Target[], correctedUtc: Date): TimeResult[] {
  if (native) {
    try {
      return fetchTimesNative(targets, correctedUtc)
    } catch {
      console.warn('[wristworks] native formatting failed, falling back to TS')
    }
  }
  return fetchTimesTs(targets, correctedUtc)
}
