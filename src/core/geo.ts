import geoLite from 'geoip-lite'
import { cacheGet, cacheSet } from './cache.js'

export interface GeoResult {
  country: string
  timezone: string
  city: string
  ll: [number, number]
  provider?: string
  asn?: string
}

const localhostResult: GeoResult = { country: 'LO', timezone: 'UTC', city: 'localhost', ll: [0, 0], provider: 'localhost', asn: '' }

function isLocalhost(ip: string): boolean {
  return ip === '127.0.0.1' || ip === '::1' || ip === 'localhost' || ip === '0.0.0.0'
}

async function lookupApi(ip: string): Promise<GeoResult | null> {
  try {
    const res = await fetch(`http://ip-api.com/json/${ip}?fields=status,countryCode,city,lat,lon,timezone,isp,org,as,asname`)
    if (!res.ok) return null
    const data = await res.json() as {
      status: string; countryCode: string; city: string; lat: number; lon: number
      timezone: string; isp: string; org: string; as: string; asname: string
    }
    if (data.status !== 'success') return null
    return {
      country: data.countryCode,
      timezone: data.timezone || 'UTC',
      city: data.city || '',
      ll: [data.lat, data.lon],
      provider: data.asname || data.org || data.isp || undefined,
      asn: data.as || undefined,
    }
  } catch {
    return null
  }
}

function mergeGeo(lite: NonNullable<ReturnType<typeof geoLite.lookup>>, api: GeoResult | null): GeoResult {
  return {
    country: lite.country,
    timezone: lite.timezone || api?.timezone || 'UTC',
    city: lite.city || api?.city || '',
    ll: lite.ll ? [lite.ll[0], lite.ll[1]] : api?.ll || [0, 0],
    provider: api?.provider,
    asn: api?.asn,
  }
}

export async function lookupIp(ip: string): Promise<GeoResult | null> {
  if (isLocalhost(ip)) return localhostResult

  const cacheKey = `geo:${ip}`
  const cached = cacheGet<GeoResult>(cacheKey)
  if (cached?.value) return cached.value

  const lite = geoLite.lookup(ip)
  const api = await lookupApi(ip)

  let result: GeoResult | null = null

  if (lite && api) {
    result = mergeGeo(lite, api)
  } else if (lite) {
    result = {
      country: lite.country,
      timezone: lite.timezone || 'UTC',
      city: lite.city || '',
      ll: lite.ll ? [lite.ll[0], lite.ll[1]] : [0, 0],
    }
  } else if (api) {
    result = api
  }

  if (result) {
    cacheSet(cacheKey, result, 86400)
    return result
  }

  return null
}

export async function lookupIpWithLocation(host: string, ip: string): Promise<{ location: string; timezone: string; countryCode: string; provider?: string; asn?: string }> {
  const geo = await lookupIp(ip)
  if (!geo) return { location: '—', timezone: 'UTC', countryCode: '' }
  const parts = [geo.city, geo.country].filter(Boolean)
  return {
    location: parts.join(', ') || geo.country,
    timezone: geo.timezone,
    countryCode: geo.country,
    provider: geo.provider,
    asn: geo.asn,
  }
}
