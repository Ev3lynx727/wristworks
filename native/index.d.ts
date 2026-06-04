export interface NtpServerResult {
  host: string
  ip: string
  driftMs: number
  latencyMs: number
  jitterMs: number | null
  packetLoss: number
  status: string
  stratum: number
  lastSync: string | null
  error?: string
}

export interface FormattedTimeResult {
  name: string
  timezone: string
  label: string
  datetime: string
  offset: string
  dstActive: boolean
}

export interface TargetInput {
  name: string
  timezone: string
  label: string
}

export function calibrateNtp(servers: string[]): NtpServerResult[]
export function formatTimes(correctedUtcMs: number, targets: TargetInput[]): FormattedTimeResult[]
