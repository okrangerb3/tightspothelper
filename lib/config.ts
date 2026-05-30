import { prisma } from './db'

// Cache settings for 60 seconds to avoid hitting DB on every email
let settingsCache: Record<string, string> = {}
let cacheTime = 0
const CACHE_TTL = 60_000

async function loadSettings(): Promise<Record<string, string>> {
  const now = Date.now()
  if (now - cacheTime < CACHE_TTL && Object.keys(settingsCache).length > 0) {
    return settingsCache
  }

  try {
    const rows = await (prisma as any).siteSettings.findMany()
    const map: Record<string, string> = {}
    for (const row of rows) {
      map[row.key] = row.value
    }
    settingsCache = map
    cacheTime = now
    return map
  } catch {
    return settingsCache // return stale cache on error
  }
}

// Clear cache when settings are updated
export function clearSettingsCache() {
  settingsCache = {}
  cacheTime = 0
}

// Get a setting — DB first, env var fallback
export async function getSetting(key: string, envFallback?: string): Promise<string | null> {
  const settings = await loadSettings()
  return settings[key] ?? envFallback ?? process.env[key] ?? null
}

// Get multiple settings at once
export async function getSettings(keys: string[]): Promise<Record<string, string | null>> {
  const settings = await loadSettings()
  const result: Record<string, string | null> = {}
  for (const key of keys) {
    result[key] = settings[key] ?? process.env[key] ?? null
  }
  return result
}
