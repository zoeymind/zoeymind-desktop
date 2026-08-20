import { logger } from "@zoeymind/logger"
import { execute, select } from "./db"

const cache = new Map<string, string>()
const LEGACY_MIGRATION_KEY = "local-storage-v1"
let installed = false

interface PreferenceRow {
  key: string
  value_json: string
}

export async function initializePreferences(): Promise<void> {
  const rows = await select<PreferenceRow>("SELECT key, value_json FROM app_kv")
  cache.clear()
  for (const row of rows) {
    const value = parseStoredValue(row.value_json)
    if (value !== null) cache.set(row.key, value)
  }
  if (
    !cache.has(LEGACY_MIGRATION_KEY) &&
    typeof window !== "undefined" &&
    "localStorage" in window
  ) {
    const legacyValues: Array<[string, string]> = []
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index)
      if (!key) continue
      const value = window.localStorage.getItem(key)
      if (value !== null) legacyValues.push([key, value])
    }
    for (const [key, value] of legacyValues) await writePreference(key, value)
    await writePreference(LEGACY_MIGRATION_KEY, "done")
    window.localStorage.clear()
  }
  installPreferenceStorage()
}

export function getPreference(key: string): string | null {
  return cache.get(key) ?? null
}

export function setPreference(key: string, value: string): void {
  cache.set(key, value)
  void writePreference(key, value).catch(error => {
    logger.error("[Preferences] Failed to persist value", { error, key })
  })
}

export function removePreference(key: string): void {
  cache.delete(key)
  void execute("DELETE FROM app_kv WHERE key = $1", [key]).catch(error => {
    logger.error("[Preferences] Failed to remove value", { error, key })
  })
}

function installPreferenceStorage(): void {
  if (installed || typeof window === "undefined") return
  const storage: Storage = {
    get length() {
      return cache.size
    },
    clear() {
      const keys = [...cache.keys()]
      cache.clear()
      for (const key of keys) {
        void execute("DELETE FROM app_kv WHERE key = $1", [key]).catch(error => {
          logger.error("[Preferences] Failed to clear value", { error, key })
        })
      }
    },
    getItem: getPreference,
    key(index) {
      return [...cache.keys()][index] ?? null
    },
    removeItem: removePreference,
    setItem: setPreference,
  }
  Object.defineProperty(window, "localStorage", { configurable: true, value: storage })
  installed = true
}

function parseStoredValue(value: string): string | null {
  try {
    const parsed = JSON.parse(value)
    return typeof parsed === "string" ? parsed : value
  } catch {
    return value
  }
}

async function writePreference(key: string, value: string): Promise<void> {
  cache.set(key, value)
  await execute(
    `INSERT INTO app_kv (key, value_json, updated_at) VALUES ($1,$2,$3)
     ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at`,
    [key, JSON.stringify(value), Date.now()]
  )
}
