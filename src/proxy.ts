import { readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import type { ProxyConfig, ProxyInfo, VpnInfo, ProxyOutput } from './types.js'

const VPN_INTERFACES = ['tun0', 'tun1', 'tap0', 'tap1', 'ppp0', 'wg0', 'utun']

function detectVpn(): VpnInfo {
  try {
    const netDir = '/proc/net'
    const routes = readFileSync('/proc/net/route', 'utf-8')
    const lines = routes.trim().split('\n').slice(1)
    for (const line of lines) {
      const [iface, dest] = line.split('\t')
      if (!iface || !dest) continue
      if (iface === 'lo') continue
      if (dest !== '00000000') {
        return { active: true, interface: iface, type: 'route' }
      }
    }
  } catch {
  }

  try {
    const stdout = execSync('ip route show default 2>/dev/null || true', {
      timeout: 3000,
      encoding: 'utf-8',
    })
    for (const iface of VPN_INTERFACES) {
      if (stdout.includes(iface)) {
        return { active: true, interface: iface, type: 'tunnel' }
      }
    }
  } catch {
  }

  try {
    const out = execSync("ip link show 2>/dev/null || ifconfig -a 2>/dev/null || true", {
      timeout: 3000,
      encoding: 'utf-8',
    })
    for (const iface of VPN_INTERFACES) {
      if (out.includes(iface)) {
        return { active: true, interface: iface, type: 'tunnel' }
      }
    }
  } catch {
  }

  return { active: false }
}

function parseProxyUrl(raw: string): ProxyInfo | null {
  try {
    return JSON.parse(raw) as ProxyInfo
  } catch {
  }
  const parts = raw.split('://')
  if (parts.length < 2) return null
  const [protocol, rest] = parts
  const [ip, portStr] = rest.split(':')
  const port = parseInt(portStr) || 1080
  return {
    proxy: raw,
    protocol,
    ip,
    port,
    https: false,
    anonymity: 'transparent',
    score: 1,
    geolocation: { country: 'ZZ', city: 'Unknown' },
  }
}

export function buildProxyOutput(cfg?: ProxyConfig): ProxyOutput | undefined {
  if (!cfg || !cfg.enabled) return undefined

  const vpn = cfg.autoDetectVpn ? detectVpn() : { active: false }
  const proxies: ProxyInfo[] = []
  const seen = new Set<string>()

  if (cfg.proxies.length > 0) {
    for (const raw of cfg.proxies) {
      const info = parseProxyUrl(raw)
      if (info && !seen.has(info.proxy)) {
        proxies.push(info)
        seen.add(info.proxy)
      }
    }
  }

  const envRaw = process.env.WRISTWORKS_PROXY
  if (envRaw) {
    const info = parseProxyUrl(envRaw)
    if (info && !seen.has(info.proxy)) {
      proxies.push(info)
      seen.add(info.proxy)
    }
  }

  return { proxies, vpn }
}
