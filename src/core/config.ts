import { readFileSync, existsSync } from 'node:fs'
import yaml from 'js-yaml'
import 'dotenv/config'
import type { WristworksConfig, Target, NtpConfig, CurrencyConfig, ConversionPreset } from './types.js'

interface YamlDoc {
  ntp?: {
    servers?: string[]
    timeout_ms?: number
    sync_interval_secs?: number
    polls?: number
    poll_interval_ms?: number
  }
  targets?: {
    name?: string
    timezone?: string
    label?: string
    enabled?: boolean
    countryCode?: string
    city?: string
    confidence?: string
    coordinates?: { lat: number; lon: number }
  }[]
  proxy?: {
    enabled?: boolean
    proxies?: string[]
    auto_detect_vpn?: boolean
  }
  currency?: {
    base?: string
    cache_ttl_secs?: number
    conversions?: {
      amount?: number
      from?: string
      to?: string
    }[]
  }
  servers?: {
    name?: string
    host?: string
    timezone?: string
    location?: string
    port?: number
    provider?: string
    asn?: string
  }[]
  agent?: {
    enabled?: boolean
    model?: string
    ollama_url?: string
    max_steps?: number
  }
}

function parseEnvTargets(raw: string): Target[] {
  return raw.split(',').filter(Boolean).map(entry => {
    const parts = entry.split('|')
    return {
      name: parts[2] || parts[0],
      timezone: parts[0],
      label: parts[1] || '',
      enabled: true,
      countryCode: parts[3] || undefined,
      city: parts[4] || undefined,
      confidence: parts[5] || undefined,
    }
  })
}

function defaultNtp(): NtpConfig {
  return {
    servers: ['pool.ntp.org', 'time.google.com', 'time.cloudflare.com'],
    timeoutMs: 5000,
    syncIntervalSecs: 300,
    polls: 5,
    pollIntervalMs: 200,
  }
}

function loadFromYaml(path: string): WristworksConfig {
  const raw = readFileSync(path, 'utf-8')
  const doc = yaml.load(raw) as YamlDoc
  const def = defaultNtp()
  return {
    ntp: {
      servers: doc.ntp?.servers || def.servers,
      timeoutMs: doc.ntp?.timeout_ms ?? def.timeoutMs,
      syncIntervalSecs: doc.ntp?.sync_interval_secs ?? def.syncIntervalSecs,
      polls: doc.ntp?.polls ?? def.polls,
      pollIntervalMs: doc.ntp?.poll_interval_ms ?? def.pollIntervalMs,
    },
    targets: (doc.targets || []).map(t => ({
      name: t.name || t.timezone || '',
      timezone: t.timezone || '',
      label: t.label || '',
      enabled: t.enabled !== false,
      countryCode: t.countryCode,
      city: t.city,
      confidence: t.confidence,
      coordinates: t.coordinates,
    })),
    proxy: doc.proxy
      ? {
          enabled: doc.proxy.enabled ?? false,
          proxies: doc.proxy.proxies || [],
          autoDetectVpn: doc.proxy.auto_detect_vpn ?? true,
        }
      : undefined,
    currency: doc.currency
      ? parseCurrencyYaml(doc.currency)
      : undefined,
    servers: doc.servers
      ? doc.servers.map(s => ({
          name: s.name || s.host || '',
          host: s.host || '',
          timezone: s.timezone || 'UTC',
          location: s.location || '',
          port: s.port,
          provider: s.provider,
          asn: s.asn,
        }))
      : undefined,
    agent: doc.agent
      ? {
          enabled: doc.agent.enabled ?? true,
          model: doc.agent.model || 'qwen2.5:3b',
          ollamaUrl: doc.agent.ollama_url || 'http://localhost:11434',
          maxSteps: doc.agent.max_steps ?? 8,
        }
      : undefined,
  }
}

function parseCurrencyYaml(raw: NonNullable<YamlDoc['currency']>): CurrencyConfig {
  const conversions: ConversionPreset[] = (raw.conversions || []).map(c => ({
    amount: c.amount ?? 1,
    from: c.from || '',
    to: c.to,
  }))
  return {
    base: raw.base || 'USD',
    cacheTtlSecs: raw.cache_ttl_secs ?? 300,
    conversions,
  }
}

function loadFromEnv(): WristworksConfig {
  const def = defaultNtp()
  const rawServers = process.env.WRISTWORKS_NTP_SERVERS
  const rawProxies = process.env.WRISTWORKS_PROXY_LIST
  return {
    ntp: {
      servers: rawServers
        ? rawServers.split(',').map(s => s.trim()).filter(Boolean)
        : def.servers,
      timeoutMs: Number(process.env.WRISTWORKS_NTP_TIMEOUT) || def.timeoutMs,
      syncIntervalSecs: Number(process.env.WRISTWORKS_SYNC_INTERVAL) || def.syncIntervalSecs,
      polls: Number(process.env.WRISTWORKS_NTP_POLLS) || def.polls,
      pollIntervalMs: Number(process.env.WRISTWORKS_NTP_POLL_INTERVAL) || def.pollIntervalMs,
    },
    targets: process.env.WRISTWORKS_TARGETS
      ? parseEnvTargets(process.env.WRISTWORKS_TARGETS)
      : [],
    proxy: rawProxies
      ? {
          enabled: true,
          proxies: rawProxies.split(',').map(s => s.trim()).filter(Boolean),
          autoDetectVpn: process.env.WRISTWORKS_DETECT_VPN !== 'false',
        }
      : undefined,
    currency: process.env.WRISTWORKS_CURRENCY_CONVERSIONS
      ? parseCurrencyEnv(process.env.WRISTWORKS_CURRENCY_BASE, process.env.WRISTWORKS_CURRENCY_CONVERSIONS)
      : undefined,
  }
}

function parseCurrencyEnv(base?: string, raw?: string): CurrencyConfig {
  const defaultBase = base || 'USD'
  const conversions: ConversionPreset[] = []
  if (raw) {
    for (const entry of raw.split(',').filter(Boolean)) {
      const parts = entry.split('|')
      if (parts.length >= 2) {
        conversions.push({
          amount: parseFloat(parts[0]) || 1,
          from: parts[1],
          to: parts[2] || undefined,
        })
      }
    }
  }
  return { base: defaultBase, cacheTtlSecs: 300, conversions }
}

export function loadConfig(path?: string): WristworksConfig {
  const configPath = path || './wristworks.yaml'
  if (existsSync(configPath)) {
    return loadFromYaml(configPath)
  }
  return loadFromEnv()
}
