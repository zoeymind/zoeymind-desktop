// @ts-nocheck — desktop mirror of cloud AI chat; runtime bridged via bridge.tsx
/**
 * useCompactionStore — 把 useCompactionTrigger 内部的 phase / 最近结果挂到全局,
 * 让 ContextUsageIndicator 等 sibling 组件能读取展示 spinner / 提示.
 */

import { create } from "zustand"
import type { CompactionState as PersistedCompactionState } from "../storage/chatDB"

export type CompactionPhase = "idle" | "pending" | "done" | "error"

interface CompactionStoreState {
  phase: CompactionPhase
  compaction: PersistedCompactionState | null
  errorMessage?: string
  setPhase: (phase: CompactionPhase) => void
  setCompaction: (state: PersistedCompactionState | null) => void
  setError: (message: string) => void
  reset: () => void
}

export const useCompactionStore = create<CompactionStoreState>(set => ({
  phase: "idle",
  compaction: null,
  setPhase: phase => set({ phase, errorMessage: undefined }),
  setCompaction: compaction =>
    set({ compaction, phase: compaction ? "done" : "idle", errorMessage: undefined }),
  setError: errorMessage => set({ phase: "error", errorMessage }),
  reset: () => set({ phase: "idle", compaction: null, errorMessage: undefined }),
}))
