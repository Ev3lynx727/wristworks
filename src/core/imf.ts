import { cacheGet, cacheSet } from './cache.js'
import { getAllCountries } from 'countries-and-timezones'
import type { ImfRegion, ImfCountry, ImfIndicatorMeta, ImfIndicatorValue, ImfIndicatorSnapshot, ImfEnrichment, ImfSnapshot } from './types.js'

const BASE = 'https://www.imf.org/external/datamapper/api/v2'
const CACHE_TTL = 86_400

const A2_TO_A3: Record<string, string> = {
  AF: 'AFG', AL: 'ALB', DZ: 'DZA', AO: 'AGO', AR: 'ARG', AM: 'ARM',
  AU: 'AUS', AT: 'AUT', AZ: 'AZE', BS: 'BHS', BH: 'BHR', BD: 'BGD',
  BB: 'BRB', BY: 'BLR', BE: 'BEL', BZ: 'BLZ', BJ: 'BEN', BT: 'BTN',
  BO: 'BOL', BA: 'BIH', BW: 'BWA', BR: 'BRA', BN: 'BRN', BG: 'BGR',
  BF: 'BFA', BI: 'BDI', KH: 'KHM', CM: 'CMR', CA: 'CAN', CV: 'CPV',
  CF: 'CAF', TD: 'TCD', CL: 'CHL', CN: 'CHN', CO: 'COL', KM: 'COM',
  CG: 'COG', CD: 'COD', CR: 'CRI', CI: 'CIV', HR: 'HRV', CU: 'CUB',
  CY: 'CYP', CZ: 'CZE', DK: 'DNK', DJ: 'DJI', DM: 'DMA', DO: 'DOM',
  EC: 'ECU', EG: 'EGY', SV: 'SLV', GQ: 'GNQ', ER: 'ERI', EE: 'EST',
  SZ: 'SWZ', ET: 'ETH', FJ: 'FJI', FI: 'FIN', FR: 'FRA', GA: 'GAB',
  GM: 'GMB', GE: 'GEO', DE: 'DEU', GH: 'GHA', GR: 'GRC', GD: 'GRD',
  GT: 'GTM', GN: 'GIN', GW: 'GNB', GY: 'GUY', HT: 'HTI', HN: 'HND',
  HK: 'HKG', HU: 'HUN', IS: 'ISL', IN: 'IND', ID: 'IDN', IR: 'IRN',
  IQ: 'IRQ', IE: 'IRL', IL: 'ISR', IT: 'ITA', JM: 'JAM', JP: 'JPN',
  JO: 'JOR', KZ: 'KAZ', KE: 'KEN', KI: 'KIR', KP: 'PRK', KR: 'KOR',
  KW: 'KWT', KG: 'KGZ', LA: 'LAO', LV: 'LVA', LB: 'LBN', LS: 'LSO',
  LR: 'LBR', LY: 'LBY', LI: 'LIE', LT: 'LTU', LU: 'LUX', MO: 'MAC',
  MG: 'MDG', MW: 'MWI', MY: 'MYS', MV: 'MDV', ML: 'MLI', MT: 'MLT',
  MH: 'MHL', MR: 'MRT', MU: 'MUS', MX: 'MEX', FM: 'FSM', MD: 'MDA',
  MN: 'MNG', ME: 'MNE', MA: 'MAR', MZ: 'MOZ', MM: 'MMR', NA: 'NAM',
  NR: 'NRU', NP: 'NPL', NL: 'NLD', NZ: 'NZL', NI: 'NIC', NE: 'NER',
  NG: 'NGA', MK: 'MKD', NO: 'NOR', OM: 'OMN', PK: 'PAK', PW: 'PLW',
  PA: 'PAN', PG: 'PNG', PY: 'PRY', PE: 'PER', PH: 'PHL', PL: 'POL',
  PT: 'PRT', QA: 'QAT', RO: 'ROU', RU: 'RUS', RW: 'RWA', KN: 'KNA',
  LC: 'LCA', VC: 'VCT', WS: 'WSM', SM: 'SMR', ST: 'STP', SA: 'SAU',
  SN: 'SEN', RS: 'SRB', SC: 'SYC', SL: 'SLE', SG: 'SGP', SK: 'SVK',
  SI: 'SVN', SB: 'SLB', SO: 'SOM', ZA: 'ZAF', SS: 'SSD', ES: 'ESP',
  LK: 'LKA', SD: 'SDN', SR: 'SUR', SE: 'SWE', CH: 'CHE', SY: 'SYR',
  TW: 'TWN', TJ: 'TJK', TZ: 'TZA', TH: 'THA', TL: 'TLS', TG: 'TGO',
  TO: 'TON', TT: 'TTO', TN: 'TUN', TR: 'TUR', TM: 'TKM', TV: 'TUV',
  UG: 'UGA', UA: 'UKR', AE: 'ARE', GB: 'GBR', US: 'USA', UY: 'URY',
  UZ: 'UZB', VU: 'VUT', VA: 'VAT', VE: 'VEN', VN: 'VNM', YE: 'YEM',
  ZM: 'ZMB', ZW: 'ZWE',
}

export function alpha2to3(code: string): string | undefined {
  if (code.length === 3) return code.toUpperCase()
  return A2_TO_A3[code.toUpperCase()]
}

const COUNTRY_TO_REGION: Record<string, string> = {
  APQ: 'APQ', EUR: 'EUR', WEQ: 'WEQ', AFQ: 'AFQ', MEQ: 'MEQ',
  AUS: 'APQ', BGD: 'APQ', BRN: 'APQ', CHN: 'APQ', FJI: 'APQ', HKG: 'APQ',
  IDN: 'APQ', IND: 'APQ', JPN: 'APQ', KHM: 'APQ', KOR: 'APQ', LAO: 'APQ',
  LKA: 'APQ', MAC: 'APQ', MMR: 'APQ', MNG: 'APQ', MYS: 'APQ', NZL: 'APQ',
  PHL: 'APQ', PNG: 'APQ', SGP: 'APQ', THA: 'APQ', TON: 'APQ', TUV: 'APQ',
  VNM: 'APQ', WSM: 'APQ', MUS: 'AFQ', MDG: 'AFQ', MWI: 'AFQ', MLI: 'AFQ',
  MOZ: 'AFQ', MRT: 'AFQ', NAM: 'AFQ', NER: 'AFQ', NGA: 'AFQ', RWA: 'AFQ',
  SEN: 'AFQ', SLE: 'AFQ', SOM: 'AFQ', SSD: 'AFQ', STP: 'AFQ', SWZ: 'AFQ',
  SYC: 'AFQ', TCD: 'AFQ', TGO: 'AFQ', TZA: 'AFQ', UGA: 'AFQ', ZAF: 'AFQ',
  ZMB: 'AFQ', ZWE: 'AFQ', AGO: 'AFQ', BEN: 'AFQ', BWA: 'AFQ', BFA: 'AFQ',
  BDI: 'AFQ', CPV: 'AFQ', CMR: 'AFQ', CAF: 'AFQ', COM: 'AFQ', COG: 'AFQ',
  CIV: 'AFQ', COD: 'AFQ', DJI: 'AFQ', GNQ: 'AFQ', ERI: 'AFQ', ETH: 'AFQ',
  GAB: 'AFQ', GMB: 'AFQ', GHA: 'AFQ', GIN: 'AFQ', GNB: 'AFQ', KEN: 'AFQ',
  LSO: 'AFQ', LBR: 'AFQ', MDV: 'AFQ',
  ALB: 'EUR', AUT: 'EUR', BEL: 'EUR', BGR: 'EUR', BIH: 'EUR', BLR: 'EUR',
  CHE: 'EUR', CYP: 'EUR', CZE: 'EUR', DEU: 'EUR', DNK: 'EUR', ESP: 'EUR',
  EST: 'EUR', FIN: 'EUR', FRA: 'EUR', GBR: 'EUR', GRC: 'EUR', HRV: 'EUR',
  HUN: 'EUR', IRL: 'EUR', ISL: 'EUR', ITA: 'EUR', LTU: 'EUR', LUX: 'EUR',
  LVA: 'EUR', MDA: 'EUR', MKD: 'EUR', MLT: 'EUR', MNE: 'EUR', NLD: 'EUR',
  NOR: 'EUR', POL: 'EUR', PRT: 'EUR', ROU: 'EUR', SRB: 'EUR', SVK: 'EUR',
  SVN: 'EUR', SWE: 'EUR', UKR: 'EUR', XKX: 'EUR',
  ARE: 'MEQ', AFG: 'MEQ', ARM: 'MEQ', AZE: 'MEQ', BHR: 'MEQ',
  DZA: 'MEQ', EGY: 'MEQ', GEO: 'MEQ', IRN: 'MEQ', IRQ: 'MEQ', JOR: 'MEQ',
  KAZ: 'MEQ', KGZ: 'MEQ', KWT: 'MEQ', LBN: 'MEQ', LBY: 'MEQ', MAR: 'MEQ',
  OMN: 'MEQ', PAK: 'MEQ', QAT: 'MEQ', SAU: 'MEQ', SDN: 'MEQ', SYR: 'MEQ',
  TJK: 'MEQ', TKM: 'MEQ', TUN: 'MEQ', TUR: 'MEQ', UZB: 'MEQ', YEM: 'MEQ',
  ANT: 'WEQ', ARG: 'WEQ', BHS: 'WEQ', BLZ: 'WEQ', BOL: 'WEQ', BRA: 'WEQ',
  BRB: 'WEQ', CAN: 'WEQ', CHL: 'WEQ', COL: 'WEQ', CRI: 'WEQ', CUB: 'WEQ',
  DMA: 'WEQ', DOM: 'WEQ', ECU: 'WEQ', GRD: 'WEQ', GTM: 'WEQ', GUY: 'WEQ',
  HND: 'WEQ', HTI: 'WEQ', JAM: 'WEQ', KNA: 'WEQ', LCA: 'WEQ', MEX: 'WEQ',
  NIC: 'WEQ', PAN: 'WEQ', PER: 'WEQ', PRY: 'WEQ', SLV: 'WEQ', SUR: 'WEQ',
  TTO: 'WEQ', URY: 'WEQ', USA: 'WEQ', VCT: 'WEQ', VEN: 'WEQ',
}

export function countryToRegion(code: string): string | undefined {
  const a3 = alpha2to3(code)
  return a3 ? COUNTRY_TO_REGION[a3] : undefined
}

export async function getCountriesByRegion(regionCode?: string): Promise<{ region: ImfRegion; countries: ImfCountry[] }[]> {
  const [regions, countries] = await Promise.all([fetchRegions(), fetchCountries()])
  if (regionCode) {
    const region = regions.find(r => r.code === regionCode.toUpperCase())
    if (!region) throw new Error(`Unknown IMF region: ${regionCode}`)
    const filtered = countries.filter(c => COUNTRY_TO_REGION[c.code] === regionCode.toUpperCase())
    return [{ region, countries: filtered }]
  }
  return regions.map(r => ({
    region: r,
    countries: countries.filter(c => COUNTRY_TO_REGION[c.code] === r.code),
  }))
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`IMF API ${res.status}: ${res.statusText}`)
  return res.json() as Promise<T>
}

export async function fetchRegions(): Promise<ImfRegion[]> {
  const cached = cacheGet<ImfRegion[]>('imf:regions')
  if (cached && cached.fresh) return cached.value
  const data = await fetchJson<{ regions: Record<string, { label: string }> }>(`${BASE}/regions`)
  const regions = Object.entries(data.regions).map(([code, v]) => ({ code, label: v.label }))
  cacheSet('imf:regions', regions, CACHE_TTL)
  return regions
}

export async function fetchCountries(): Promise<ImfCountry[]> {
  const cached = cacheGet<ImfCountry[]>('imf:countries')
  if (cached && cached.fresh) return cached.value
  const data = await fetchJson<{ countries: Record<string, { label: string }> }>(`${BASE}/countries`)
  const countries = Object.entries(data.countries).map(([code, v]) => ({ code, label: v.label }))
  cacheSet('imf:countries', countries, CACHE_TTL)
  return countries
}

export async function fetchIndicatorsMeta(): Promise<Record<string, ImfIndicatorMeta>> {
  const cached = cacheGet<Record<string, ImfIndicatorMeta>>('imf:indicators')
  if (cached && cached.fresh) return cached.value
  const data = await fetchJson<{ indicators: Record<string, ImfIndicatorMeta> }>(`${BASE}/indicators`)
  cacheSet('imf:indicators', data.indicators, CACHE_TTL)
  return data.indicators
}

export function parsePeriods(input?: string): Set<string> | undefined {
  if (!input) return undefined
  const parts = input.split(',').map(s => s.trim()).filter(Boolean)
  const years = new Set<string>()
  for (const p of parts) {
    const range = p.split('-')
    if (range.length === 2) {
      const start = Number(range[0])
      const end = Number(range[1])
      if (!isNaN(start) && !isNaN(end)) {
        for (let y = start; y <= end; y++) years.add(String(y))
      }
    } else if (/^\d{4}$/.test(p)) {
      years.add(p)
    }
  }
  return years.size > 0 ? years : undefined
}

export async function fetchIndicator(
  indicator: string,
  countries: string[],
  periods?: string,
): Promise<ImfIndicatorSnapshot> {
  const key = countries.sort().join(',')
  const url = `${BASE}/${indicator}/${key}${periods ? `?periods=${periods}` : ''}`
  const cacheKey = `imf:indicator:${indicator}:${key}:${periods ?? 'all'}`
  const cached = cacheGet<ImfIndicatorSnapshot>(cacheKey)
  if (cached && cached.fresh) return cached.value
  const data = await fetchJson<{ indicators?: Record<string, { label: string }>; values?: Record<string, Record<string, Record<string, number>>> }>(url)
  const wanted = parsePeriods(periods)
  const values: Record<string, ImfIndicatorValue[]> = {}
  const indicatorValues = data.values?.[indicator] ?? {}
  for (const [country, years] of Object.entries(indicatorValues)) {
    values[country] = Object.entries(years)
      .filter(([year]) => !wanted || wanted.has(year))
      .map(([year, val]) => ({ year, value: val }))
  }
  const metaLabel = data.indicators?.[indicator]?.label
  const result: ImfIndicatorSnapshot = {
    meta: { code: indicator, label: metaLabel ?? indicator },
    values,
  }
  cacheSet(cacheKey, result, CACHE_TTL)
  return result
}

const KNOWN_COUNTRY_A3 = new Set(Object.values(A2_TO_A3))

const WB_INDICATOR_MAP: Record<string, string> = {
  PCPI: 'FP.CPI.TOTL.ZG',
  NGDP_RPCH: 'NY.GDP.MKTP.KD.ZG',
  LUR: 'SL.UEM.TOTL.ZS',
  GGXWDG_NGDP: 'GC.DOD.TOTL.GD.ZS',
}

async function fetchWorldBankIndicatorAll(wbCode: string): Promise<Record<string, number>> {
  const thisYear = new Date().getFullYear()
  for (let year = thisYear; year >= thisYear - 3; year--) {
    try {
      const url = `https://api.worldbank.org/v2/country/all/indicator/${wbCode}?format=json&per_page=500&date=${year}`
      const data = await fetchJson<[unknown, { countryiso3code: string; value: number | null }[]]>(url)
      if (!Array.isArray(data) || data.length < 2 || !Array.isArray(data[1])) continue
      const result: Record<string, number> = {}
      for (const entry of data[1]) {
        if (entry.value !== null && KNOWN_COUNTRY_A3.has(entry.countryiso3code)) {
          result[entry.countryiso3code] = entry.value
        }
      }
      if (Object.keys(result).length > 50) return result
    } catch {
      continue
    }
  }
  return {}
}

export async function enrichLocationsWithImf(
  locations: { countryCode?: string }[],
  options?: { periods?: string; indicators?: string[] },
): Promise<Record<string, ImfEnrichment>> {
  const regions = await fetchRegions()

  const alpha3Codes = locations
    .map(l => alpha2to3(l.countryCode ?? ''))
    .filter(Boolean) as string[]

  const unique = [...new Set(alpha3Codes)]
  if (unique.length === 0) return {}

  const enrichmentMap: Record<string, ImfEnrichment> = {}

  for (const code of unique) {
    const regionCode = countryToRegion(code)
    const region = regionCode ? regions.find(r => r.code === regionCode) ?? null : null
    enrichmentMap[code] = { region, indicators: {} }
  }

  const topIndicators = options?.indicators ?? ['NGDP_RPCH', 'PCPI', 'LUR', 'GGXWDG_NGDP']
  for (const indicator of topIndicators) {
    const wbCode = WB_INDICATOR_MAP[indicator]
    if (!wbCode) continue
    try {
      const values = await fetchWorldBankIndicatorAll(wbCode)
      for (const country of unique) {
        if (values[country] !== undefined) {
          enrichmentMap[country].indicators[indicator] = values[country]
        }
      }
    } catch {
      // indicator may not be available
    }
  }

  return enrichmentMap
}

const gdpRankCache = 'imf:gdp:rank'

function buildWorldometersNameToA3(): Record<string, string> {
  const countries = getAllCountries()
  const map: Record<string, string> = {}
  for (const [a2, data] of Object.entries(countries)) {
    const a3 = alpha2to3(a2)
    if (a3) map[data.name.toLowerCase()] = a3
  }
  const overrides: Record<string, string> = {
    'czech republic (czechia)': 'CZE',
    'south korea': 'KOR',
    'dr congo': 'COD',
    'russia': 'RUS',
    'turkey': 'TUR',
    'syria': 'SYR',
    'brunei': 'BRN',
    'north korea': 'PRK',
    'state of palestine': 'PSE',
    'eswatini': 'SWZ',
    'cabo verde': 'CPV',
    'timor-leste': 'TLS',
    'sao tome & principe': 'STP',
    "st. vincent & grenadines": 'VCT',
    'saint kitts & nevis': 'KNA',
    'myanmar': 'MMR',
    'congo': 'COG',
    'iran': 'IRN',
    'moldova': 'MDA',
    'laos': 'LAO',
    'macao': 'MAC',
    'taiwan': 'TWN',
    "côte d'ivoire": 'CIV',
    'vietnam': 'VNM',
    'north macedonia': 'MKD',
    'bahamas': 'BHS',
    'gambia': 'GMB',
    'guinea': 'GIN',
    'mauritius': 'MUS',
    'seychelles': 'SYC',
    'hong kong': 'HKG',
    'united arab emirates': 'ARE',
    'saudi arabia': 'SAU',
    'netherlands': 'NLD',
    'switzerland': 'CHE',
    'united kingdom': 'GBR',
    'united states': 'USA',
  }
  for (const [name, code] of Object.entries(overrides)) {
    map[name] = code
  }
  return map
}

const WORLDOMETERS_NAME_TO_A3 = buildWorldometersNameToA3()

async function fetchWorldometersGdpPage(year: number): Promise<[string, number][]> {
  const url = `https://www.worldometers.info/gdp/gdp-by-country/?source=imf&region=worldwide&year=${year}&metric=nominal`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Worldometers ${res.status}: ${res.statusText}`)
  const html = await res.text()

  const entries: [string, number][] = []
  const seen = new Set<string>()

  const tableRe = /<table[^>]*>([\s\S]*?)<\/table>/g
  const tableMatch = tableRe.exec(html)
  if (!tableMatch) return entries

  const trRe = /<tr[^>]*>([\s\S]*?)<\/tr>/g
  let trMatch: RegExpExecArray | null
  while ((trMatch = trRe.exec(tableMatch[1])) !== null) {
    const trBody = trMatch[1]
    if (!trBody.includes('$')) continue
    const tdRe = /<td[^>]*>([\s\S]*?)<\/td>/g
    const tds: string[] = []
    let tdMatch: RegExpExecArray | null
    while ((tdMatch = tdRe.exec(trBody)) !== null) {
      tds.push(tdMatch[1].trim())
    }
    if (tds.length < 4) continue
    const rankStr = tds[0].replace(/[^0-9]/g, '')
    if (!rankStr) continue
    const countryName = tds[1].replace(/<[^>]*>/g, '').trim()
    const gdpTd = tds[3]
    const gdpMatch = gdpTd.match(/\$([0-9,]+)/)
    if (!gdpMatch) continue
    const gdp = parseFloat(gdpMatch[1].replace(/,/g, ''))
    const a3 = WORLDOMETERS_NAME_TO_A3[countryName.toLowerCase()]
    if (a3 && !isNaN(gdp) && gdp > 0 && !seen.has(a3)) {
      seen.add(a3)
      entries.push([a3, gdp])
    }
  }

  return entries
}

export async function fetchGdpRankings(): Promise<Record<string, number>> {
  const cached = cacheGet<Record<string, number>>(gdpRankCache)
  if (cached && cached.fresh) return cached.value

  const thisYear = new Date().getFullYear()
  let entries: [string, number][] = []
  for (let year = thisYear; year >= thisYear - 3; year--) {
    try {
      entries = await fetchWorldometersGdpPage(year)
      if (entries.length > 20) break
    } catch {
      continue
    }
  }

  if (entries.length === 0) throw new Error('Failed to fetch GDP rankings from Worldometers')

  entries.sort((a, b) => b[1] - a[1])
  const rankings: Record<string, number> = {}
  entries.forEach(([code], i) => { rankings[code] = i + 1 })

  cacheSet(gdpRankCache, rankings, CACHE_TTL)
  return rankings
}

export async function fetchImfSnapshot(code: string): Promise<ImfSnapshot> {
  const a3 = alpha2to3(code)
  if (!a3) throw new Error(`Unknown country code: ${code}`)

  const [regions, countries, indicators] = await Promise.all([
    fetchRegions(),
    fetchCountries(),
    fetchIndicatorsMeta(),
  ])

  return { regions, countries, indicators }
}
