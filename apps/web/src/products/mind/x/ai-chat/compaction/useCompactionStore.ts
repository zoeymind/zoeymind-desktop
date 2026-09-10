/**
 * useCompactionStore — 把 useCompactionTrigger 内部的 phase / 最近结果挂到全局,
 * 让 ContextUsageIndicator 等 sibling 组件能读取展示 spinner / 提示.
 */

import { create } from "zustand"
import type { CompactionState as PersistedCompactionState } from "../storage/sqliteChatStore"

export type CompactionPhase = "idle" | "pending" | "done" | "error"

interface CompactionStoreState {
  conversationId?: string
  attemptId?: string
  phase: CompactionPhase
  compaction: PersistedCompactionState | null
  errorMessage?: string
}

export const useCompactionStore = create<CompactionStoreState>(() => ({
  phase: "idle",
  compaction: null,
}))

export function resetCompaction(conversationId: string | undefined): void {
  useCompactionStore.setState({
    conversationId,
    attemptId: undefined,
    phase: "idle",
    compaction: null,
    errorMessage: undefined,
  })
}

export function setConversationCompaction(
  conversationId: string | undefined,
  compaction: PersistedCompactionState | null
): void {
  useCompactionStore.setState({
    conversationId,
    attemptId: undefined,
    phase: compaction ? "done" : "idle",
    compaction,
    errorMessage: undefined,
  })
}

export function beginCompaction(conversationId: string, attemptId: string): boolean {
  const current = useCompactionStore.getState()
  if (current.conversationId !== undefined && current.conversationId !== conversationId)
    return false
  useCompactionStore.setState({
    conversationId,
    attemptId,
    phase: "pending",
    errorMessage: undefined,
  })
  return true
}

export function publishCompaction(
  conversationId: string,
  attemptId: string,
  compaction: PersistedCompactionState
): void {
  const current = useCompactionStore.getState()
  if (current.conversationId !== conversationId || current.attemptId !== attemptId) return
  useCompactionStore.setState({
    attemptId: undefined,
    compaction,
    phase: "done",
    errorMessage: undefined,
  })
}

export function finishCompactionWithoutChange(conversationId: string, attemptId: string): void {
  const current = useCompactionStore.getState()
  if (current.conversationId !== conversationId || current.attemptId !== attemptId) return
  useCompactionStore.setState({ attemptId: undefined, phase: "idle", errorMessage: undefined })
}

export function publishCompactionError(
  conversationId: string,
  attemptId: string,
  message: string
): void {
  const current = useCompactionStore.getState()
  if (current.conversationId !== conversationId || current.attemptId !== attemptId) return
  useCompactionStore.setState({ attemptId: undefined, phase: "error", errorMessage: message })
}

export function ownsCompactionAttempt(conversationId: string, attemptId: string): boolean {
  const current = useCompactionStore.getState()
  return current.conversationId === conversationId && current.attemptId === attemptId
}
