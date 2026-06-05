import { resolve4, resolve6, resolveMx, resolveNs, resolveTxt, resolveCname, resolveSoa, resolvePtr, resolveCaa } from 'node:dns/promises'
import { lookupIpWithLocation } from './geo.js'
import { probeHttp } from './probe.js'

export interface DnsRecord {
  type: string
  value: string
}

export interface DnsDigResult {
  domain: string
  host: string
  resolved: boolean
  records: DnsRecord[]
  ips: string[]
  location?: string
  timezone?: string
  countryCode?: string
  provider?: string
  asn?: string
  up?: boolean
  server?: string
  statusCode?: number
  probeLatencyMs?: number
  lookupTimeMs: number
}

export function stripUrl(s: string): string {
  try { return new URL(s).hostname } catch { return s.replace(/^https?:\/\//, '').split('/')[0].split('?')[0] }
}

function fmt(records: { type: string; value: string }[]): DnsRecord[] {
  return records.map(r => ({ type: r.type, value: r.value }))
}

async function resolveARecords(host: string): Promise<string[]> {
  try {
    const addrs = await resolve4(host)
    return addrs
  } catch { return [] }
}

async function resolveAaaaRecords(host: string): Promise<string[]> {
  try {
    const addrs = await resolve6(host)
    return addrs
  } catch { return [] }
}

async function resolveMxRecords(host: string): Promise<DnsRecord[]> {
  try {
    const mx = await resolveMx(host)
    return fmt(mx.map(m => ({ type: 'MX', value: `${m.priority} ${m.exchange}` })))
  } catch { return [] }
}

async function resolveNsRecords(host: string): Promise<DnsRecord[]> {
  try {
    const ns = await resolveNs(host)
    return fmt(ns.map(n => ({ type: 'NS', value: n })))
  } catch { return [] }
}

async function resolveTxtRecords(host: string): Promise<DnsRecord[]> {
  try {
    const txt = await resolveTxt(host)
    return fmt(txt.map(t => ({ type: 'TXT', value: t.join('') })))
  } catch { return [] }
}

async function resolveCnameRecords(host: string): Promise<DnsRecord[]> {
  try {
    const cname = await resolveCname(host)
    return fmt(cname.map(c => ({ type: 'CNAME', value: c })))
  } catch { return [] }
}

async function resolveSoaRecord(host: string): Promise<DnsRecord[]> {
  try {
    const soa = await resolveSoa(host)
    return [{ type: 'SOA', value: `${soa.nsname} ${soa.hostmaster} (${soa.serial})` }]
  } catch { return [] }
}

async function resolvePtrRecord(ip: string): Promise<DnsRecord[]> {
  try {
    const ptr = await resolvePtr(ip)
    return fmt(ptr.map(p => ({ type: 'PTR', value: p })))
  } catch { return [] }
}

async function resolveCaaRecords(host: string): Promise<DnsRecord[]> {
  try {
    const caa = await resolveCaa(host)
    return fmt(caa.map(c => ({ type: 'CAA', value: `critical=${c.critical}${c.issue ? ` issue="${c.issue}"` : ''}${c.issuewild ? ` issuewild="${c.issuewild}"` : ''}${c.iodef ? ` iodef="${c.iodef}"` : ''}` })))
  } catch { return [] }
}

export interface DnsDigOptions {
  probe?: boolean
  timeoutMs?: number
}

export async function dnsDig(input: string, options?: DnsDigOptions): Promise<DnsDigResult> {
  const start = Date.now()
  const host = stripUrl(input)

  const ipv4 = await resolveARecords(host)
  const ipv6 = await resolveAaaaRecords(host)
  const ips = [...ipv4, ...ipv6]
  const resolved = ips.length > 0

  const [mx, ns, txt, cname, soa, caa, ...ptrResults] = await Promise.all([
    resolveMxRecords(host),
    resolveNsRecords(host),
    resolveTxtRecords(host),
    resolveCnameRecords(host),
    resolveSoaRecord(host),
    resolveCaaRecords(host),
    ...(resolved ? ipv4.map(resolvePtrRecord) : []),
  ])

  const ptr = ptrResults.flat()

  const records: DnsRecord[] = [
    ...cname,
    ...fmt(ipv4.map(ip => ({ type: 'A', value: ip }))),
    ...fmt(ipv6.map(ip => ({ type: 'AAAA', value: ip }))),
    ...mx,
    ...ns,
    ...txt,
    ...soa,
    ...caa,
    ...ptr,
  ]

  const lookupTimeMs = Date.now() - start

  let location: string | undefined
  let timezone: string | undefined
  let countryCode: string | undefined
  let provider: string | undefined
  let asn: string | undefined
  let up: boolean | undefined
  let server: string | undefined
  let statusCode: number | undefined
  let probeLatencyMs: number | undefined

  if (resolved) {
    const geo = await lookupIpWithLocation(host, ipv4[0] || ipv6[0])
    location = geo.location
    timezone = geo.timezone
    countryCode = geo.countryCode
    provider = geo.provider
    asn = geo.asn

    if (options?.probe) {
      const probe = await probeHttp(host)
      up = probe.up
      server = probe.server
      statusCode = probe.statusCode
      probeLatencyMs = probe.latencyMs
    }
  }

  return {
    domain: input,
    host,
    resolved,
    records,
    ips,
    location,
    timezone,
    countryCode,
    provider,
    asn,
    up,
    server,
    statusCode,
    probeLatencyMs,
    lookupTimeMs,
  }
}
