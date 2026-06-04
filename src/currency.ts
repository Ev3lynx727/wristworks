import type { CurrencyRates, CurrencyConversion, MultiConvertRequest, MultiConvertResult, UnifiedCurrencyOptions, UnifiedCurrencySnapshot, TimeResult } from './types.js'
import { uniqueCurrenciesForTargets, currencyForCountry } from './currency-map.js'
import { DEFAULT_CURRENCY_TARGETS, DEFAULT_CURRENCY_PAIRS } from './constants.js'
import { cacheGet, cacheSet } from './cache.js'

interface CacheEntry {
  rates: Record<string, number>
  base: string
  timestamp: number
  source: string
}

interface RawRates {
  base: string
  rates: Record<string, number>
  timestamp: number
}

interface CurrencySource {
  name: string
  base: string
  fetch(): Promise<RawRates>
}

const DEFAULT_TTL = 300
const MAX_STALE = 600

function now(): number {
  return Date.now()
}

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms))
}

async function fetchJson(url: string, timeoutMs: number): Promise<any> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, { signal: controller.signal })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.json()
  } finally {
    clearTimeout(timer)
  }
}

const moneyconvertSource: CurrencySource = {
  name: 'moneyconvert',
  base: 'USD',
  async fetch(): Promise<RawRates> {
    const data = await fetchJson('https://cdn.moneyconvert.net/api/latest.json', 3000)
    return {
      base: 'USD',
      rates: data.rates,
      timestamp: now(),
    }
  },
}

const frankfurterSource: CurrencySource = {
  name: 'frankfurter',
  base: 'EUR',
  async fetch(): Promise<RawRates> {
    const data = await fetchJson('https://api.frankfurter.dev/latest', 3000)
    return {
      base: 'EUR',
      rates: data.rates,
      timestamp: new Date(data.date).getTime() || now(),
    }
  },
}

const sources: CurrencySource[] = [moneyconvertSource, frankfurterSource]

async function fetchWithRetry(source: CurrencySource): Promise<RawRates> {
  let lastErr: Error | null = null
  for (let attempt = 0; attempt <= 1; attempt++) {
    try {
      return await source.fetch()
    } catch (err) {
      lastErr = err instanceof Error ? err : new Error(String(err))
      if (attempt < 1) await sleep(500)
    }
  }
  throw lastErr!
}

function normalizeRates(raw: RawRates, targetBase: string, sourceName: string): CacheEntry {
  if (raw.base === targetBase) {
    return {
      base: targetBase,
      rates: { ...raw.rates },
      timestamp: raw.timestamp,
      source: sourceName,
    }
  }

  const sourceToTarget = 1 / (raw.rates[targetBase] ?? 1)
  const rates: Record<string, number> = {}

  for (const [code, rate] of Object.entries(raw.rates)) {
    rates[code] = +(rate * sourceToTarget).toFixed(6)
  }
  rates[raw.base] = +sourceToTarget.toFixed(6)

  return {
    base: targetBase,
    rates,
    timestamp: raw.timestamp,
    source: sourceName,
  }
}

function isFresh(entry: CacheEntry, ttl: number): boolean {
  return (now() - entry.timestamp) < ttl * 1000
}

function getCached(key: string): CacheEntry | undefined {
  const r = cacheGet<CacheEntry>(key)
  return r ? r.value : undefined
}

function setCached(key: string, entry: CacheEntry): void {
  cacheSet(key, entry, DEFAULT_TTL, MAX_STALE)
}

let refreshInProgress = false

async function refreshCache(base: string, ttl: number): Promise<void> {
  if (refreshInProgress) return
  refreshInProgress = true
  try {
    for (const source of sources) {
      try {
        const raw = await fetchWithRetry(source)
        const entry = normalizeRates(raw, base, source.name)
        setCached(`rates:${base}`, entry)
        return
      } catch {
      }
    }
  } finally {
    refreshInProgress = false
  }
}

export async function fetchRates(
  base = 'USD',
  ttl = DEFAULT_TTL,
): Promise<CurrencyRates> {
  const key = `rates:${base.toUpperCase()}`
  let cached = getCached(key)

  if (cached && isFresh(cached, ttl)) {
    return {
      base: cached.base,
      rates: { ...cached.rates },
      timestamp: new Date(cached.timestamp).toISOString(),
      source: cached.source,
      stale: false,
    }
  }

  if (cached && (now() - cached.timestamp) < MAX_STALE * 1000) {
    refreshCache(base, ttl)
    return {
      base: cached.base,
      rates: { ...cached.rates },
      timestamp: new Date(cached.timestamp).toISOString(),
      source: cached.source,
      stale: true,
    }
  }

  for (const source of sources) {
    try {
      const raw = await fetchWithRetry(source)
      const entry = normalizeRates(raw, base.toUpperCase(), source.name)
      setCached(key, entry)
      return {
        base: entry.base,
        rates: { ...entry.rates },
        timestamp: new Date(entry.timestamp).toISOString(),
        source: entry.source,
        stale: false,
      }
    } catch (err) {
      console.warn(`[wristworks] currency source ${source.name} failed:`, err)
    }
  }

  if (cached) {
    console.warn('[wristworks] all currency sources failed, serving stale')
    return {
      base: cached.base,
      rates: { ...cached.rates },
      timestamp: new Date(cached.timestamp).toISOString(),
      source: cached.source,
      stale: true,
    }
  }

  throw new Error('All currency sources unavailable')
}

export async function convertCurrency(
  amount: number,
  from: string,
  to: string,
  ttl?: number,
): Promise<CurrencyConversion> {
  const fromUC = from.toUpperCase()
  const toUC = to.toUpperCase()

  if (fromUC === toUC) {
    return {
      from: { currency: fromUC, amount },
      to: { currency: toUC, amount },
      rate: 1,
      timestamp: new Date().toISOString(),
      source: 'identity',
      stale: false,
    }
  }

  const rates = await fetchRates('USD', ttl)
  const usdToFrom = rates.rates[fromUC]
  const usdToTo = rates.rates[toUC]

  if (usdToFrom === undefined) throw new Error(`Unknown currency: ${fromUC}`)
  if (usdToTo === undefined) throw new Error(`Unknown currency: ${toUC}`)

  const rate = usdToTo / usdToFrom
  return {
    from: { currency: fromUC, amount },
    to: { currency: toUC, amount: +(amount * rate).toFixed(2) },
    rate: +rate.toFixed(6),
    timestamp: rates.timestamp,
    source: rates.source,
    stale: rates.stale,
  }
}

export async function multiConvert(
  conversions: MultiConvertRequest[],
  ttl?: number,
): Promise<MultiConvertResult[]> {
  if (conversions.length === 0) return []

  const currencies = new Set<string>()
  for (const c of conversions) {
    currencies.add(c.from.toUpperCase())
    currencies.add(c.to.toUpperCase())
  }

  const rates = await fetchRates('USD', ttl)
  const results: MultiConvertResult[] = []

  for (const c of conversions) {
    const fromUC = c.from.toUpperCase()
    const toUC = c.to.toUpperCase()

    if (fromUC === toUC) {
      results.push({
        from: { currency: fromUC, amount: c.amount },
        to: { currency: toUC, amount: c.amount },
        rate: 1,
        timestamp: rates.timestamp,
        source: 'identity',
        stale: false,
      })
      continue
    }

    const usdToFrom = rates.rates[fromUC]
    const usdToTo = rates.rates[toUC]

    if (usdToFrom === undefined) throw new Error(`Unknown currency: ${fromUC}`)
    if (usdToTo === undefined) throw new Error(`Unknown currency: ${toUC}`)

    const rate = usdToTo / usdToFrom
    results.push({
      from: { currency: fromUC, amount: c.amount },
      to: { currency: toUC, amount: +(c.amount * rate).toFixed(2) },
      rate: +rate.toFixed(6),
      timestamp: rates.timestamp,
      source: rates.source,
      stale: rates.stale,
    })
  }

  return results
}

export async function unifiedCurrency(opts?: UnifiedCurrencyOptions): Promise<UnifiedCurrencySnapshot> {
  const baseRaw = opts?.base ?? 'USD'
  const bases = Array.isArray(baseRaw) ? baseRaw : [baseRaw]
  const targets = opts?.targets ?? DEFAULT_CURRENCY_TARGETS
  const ttl = opts?.ttl

  const usdRates = await fetchRates('USD', ttl)
  const uniqueTargets = [...new Set([...targets.map(t => t.toUpperCase()), ...bases.map(b => b.toUpperCase())])]

  const basesResult: Record<string, { base: string; rates: Record<string, number> }> = {}
  for (const base of bases) {
    const baseUC = base.toUpperCase()
    const usdToBase = usdRates.rates[baseUC]
    if (!usdToBase && baseUC !== 'USD') throw new Error(`Unknown base currency: ${baseUC}`)

    const filtered: Record<string, number> = {}
    for (const t of uniqueTargets) {
      const rate = usdRates.rates[t]
      if (rate === undefined) continue
      filtered[t] = baseUC === 'USD'
        ? +rate.toFixed(4)
        : +(rate / usdToBase).toFixed(6)
    }
    basesResult[baseUC] = { base: baseUC, rates: filtered }
  }

  const pairs: Record<string, number> = {}
  for (const pairStr of DEFAULT_CURRENCY_PAIRS) {
    const [from, to] = pairStr.split('/')
    const fromRate = usdRates.rates[from]
    const toRate = usdRates.rates[to]
    if (fromRate && toRate) {
      pairs[pairStr] = +(toRate / fromRate).toFixed(6)
    }
  }

  return {
    timestamp: usdRates.timestamp,
    source: usdRates.source,
    stale: usdRates.stale,
    bases: basesResult,
    pairs,
  }
}

export async function enrichLocations(
  locations: TimeResult[],
  base = 'USD',
  ttl?: number,
): Promise<TimeResult[]> {
  const countryCodes = locations
    .map(l => l.countryCode)
    .filter((c): c is string => !!c)

  const currencies = uniqueCurrenciesForTargets(countryCodes)
  if (currencies.length === 0) return locations

  const targets = [...new Set([...currencies, base])]
  const snapshot = await unifiedCurrency({ base, targets, ttl })
  const rates = snapshot.bases[base]?.rates

  if (!rates) return locations

  return locations.map(loc => {
    const cur = loc.countryCode ? currencyForCountry(loc.countryCode) : undefined
    if (!cur || !rates[cur]) return loc
    return {
      ...loc,
      currency: { code: cur, rate: rates[cur] },
    }
  })
}

export function clearCurrencyCache(): void {
  // cleared via cacheClear() import
}
