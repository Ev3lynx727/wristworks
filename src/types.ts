export interface Coordinates {
  lat: number
  lon: number
}

export interface Target {
  name: string
  timezone: string
  label: string
  enabled: boolean
  countryCode?: string
  city?: string
  confidence?: string
  coordinates?: Coordinates
}

export interface NtpConfig {
  servers: string[]
  timeoutMs: number
  syncIntervalSecs: number
  polls: number
  pollIntervalMs: number
}

export interface ProxyConfig {
  enabled: boolean
  proxies: string[]
  autoDetectVpn: boolean
}

export interface WristworksConfig {
  ntp: NtpConfig
  targets: Target[]
  proxy?: ProxyConfig
}

export interface CurrencyInfo {
  code: string
  rate: number
}

export interface TimeResult {
  name: string
  timezone: string
  label: string
  datetime: string
  epoch: number
  offset: string
  dstActive: boolean
  countryCode: string
  city: string
  confidence: string
  coordinates: Coordinates | null
  currency?: CurrencyInfo
}

export interface NtpServerResult {
  host: string
  ip: string
  latencyMs: number
  jitterMs: number | null
  packetLoss: number
  driftMs: number
  status: string
  stratum: number
  lastSync: string | null
  error?: string
}

export interface CalibrationBlock {
  method: string
  polls: number
  pollIntervalMs: number
  servers: NtpServerResult[]
}

export interface Audit {
  generatedBy: string
  version: string
  nextSync: string
}

export interface ProxyGeolocation {
  country: string
  city: string
}

export interface ProxyInfo {
  proxy: string
  protocol: string
  ip: string
  port: number
  https: boolean
  anonymity: string
  score: number
  geolocation: ProxyGeolocation
}

export interface VpnInfo {
  active: boolean
  interface?: string
  type?: string
}

export interface ProxyOutput {
  proxies: ProxyInfo[]
  vpn: VpnInfo
}

export interface WristworksOutput {
  calibration: CalibrationBlock
  locations: TimeResult[]
  audit: Audit
  proxy?: ProxyOutput
}

export interface CalibrationResult {
  server: string
  driftMs: number
  latencyMs: number
}

export interface CurrencyConfig {
  base: string
  cacheTtlSecs: number
}

export interface CurrencyRates {
  base: string
  rates: Record<string, number>
  timestamp: string
  source: string
  stale: boolean
}

export interface CurrencyConversion {
  from: { currency: string; amount: number }
  to: { currency: string; amount: number }
  rate: number
  timestamp: string
  source: string
  stale: boolean
}

export interface UnifiedCurrencyOptions {
  base?: string | string[]
  targets?: string[]
  ttl?: number
}

export interface UnifiedCurrencySnapshot {
  timestamp: string
  source: string
  stale: boolean
  bases: Record<string, { base: string; rates: Record<string, number> }>
  pairs: Record<string, number>
}
