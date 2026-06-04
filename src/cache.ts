import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { homedir } from 'node:os'

interface CacheRecord {
  data: unknown
  ts: number
  ttl: number
  staleTtl: number
}

const CACHE_DIR = homedir() + '/.local/state/wristworks'
const CACHE_FILE = CACHE_DIR + '/cache.json'

let loaded = false
let store: Record<string, CacheRecord> = {}

function load(): void {
  if (loaded) return
  loaded = true
  try {
    store = JSON.parse(readFileSync(CACHE_FILE, 'utf-8'))
  } catch {
    store = {}
  }
}

function save(): void {
  try {
    mkdirSync(CACHE_DIR, { recursive: true })
  } catch {}
  writeFileSync(CACHE_FILE, JSON.stringify(store))
}

export function cacheGet<T>(key: string): { value: T; fresh: boolean; ts: number } | null {
  load()
  const r = store[key]
  if (!r) return null
  const age = Date.now() - r.ts
  if (age > r.staleTtl * 1000) {
    delete store[key]
    save()
    return null
  }
  return { value: r.data as T, fresh: age < r.ttl * 1000, ts: r.ts }
}

export function cacheSet(key: string, data: unknown, ttl = 300, staleTtl = 600): void {
  load()
  store[key] = { data, ts: Date.now(), ttl, staleTtl }
  save()
}

export function cacheClear(): void {
  store = {}
  try {
    writeFileSync(CACHE_FILE, '{}')
  } catch {}
}
