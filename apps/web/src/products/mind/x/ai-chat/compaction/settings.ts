import { useSyncExternalStore } from "react"
import { getPreference, setPreference } from "@/shared/native/preferences"

export const DEFAULT_COMPACTION_THRESHOLD_PERCENT = 85
export const MIN_COMPACTION_THRESHOLD_PERCENT = 50
export const MAX_COMPACTION_THRESHOLD_PERCENT = 95

const STORAGE_KEY = "ai-chat-compaction-threshold-percent"
const CHANGE_EVENT = "zm:compaction-threshold-changed"

function normalizeThreshold(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_COMPACTION_THRESHOLD_PERCENT
  return Math.min(
    MAX_COMPACTION_THRESHOLD_PERCENT,
    Math.max(MIN_COMPACTION_THRESHOLD_PERCENT, Math.round(value))
  )
}

export function getCompactionThresholdPercent(): number {
  const raw = getPreference(STORAGE_KEY)
  if (raw === null) return DEFAULT_COMPACTION_THRESHOLD_PERCENT
  return normalizeThreshold(Number(raw))
}

export function setCompactionThresholdPercent(value: number): void {
  const threshold = normalizeThreshold(value)
  setPreference(STORAGE_KEY, String(threshold))
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(CHANGE_EVENT))
}

function subscribe(listener: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, listener)
  window.addEventListener("storage", listener)
  return () => {
    window.removeEventListener(CHANGE_EVENT, listener)
    window.removeEventListener("storage", listener)
  }
}

export function useCompactionThresholdPercent(): number {
  return useSyncExternalStore(
    subscribe,
    getCompactionThresholdPercent,
    () => DEFAULT_COMPACTION_THRESHOLD_PERCENT
  )
}
