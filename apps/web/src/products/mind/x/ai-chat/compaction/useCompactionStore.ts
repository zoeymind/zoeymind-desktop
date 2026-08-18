/**
 * useCompactionStore — 把 useCompactionTrigger 内部的 phase / 最近结果挂到全局,
 * 让 ContextUsageIndicator 等 sibling 组件能读取展示 spinner / 提示.
 */

import { create } from 'zustand'

export type CompactionPhase = 'idle' | 'pending' | 'done' | 'error'

interface CompactionState {
  phase: CompactionPhase
  /** 最近一次成功压缩的信息 */
  lastResult?: {
    compactedCount: number
    modelId: string
    at: number
  }
  errorMessage?: string

  setPhase: (phase: CompactionPhase) => void
  setLastResult: (r: { compactedCount: number; modelId: string; at: number }) => void
  setError: (msg: string) => void
  reset: () => void
}

export const useCompactionStore = create<CompactionState>(set => ({
  phase: 'idle',
  setPhase: phase => set({ phase, errorMessage: undefined }),
  setLastResult: r => set({ lastResult: r, phase: 'done', errorMessage: undefined }),
  setError: msg => set({ phase: 'error', errorMessage: msg }),
  reset: () => set({ phase: 'idle', lastResult: undefined, errorMessage: undefined })
}))
