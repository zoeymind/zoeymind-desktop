// @ts-nocheck — desktop mirror of cloud AI chat; runtime bridged via bridge.tsx
/**
 * useMemoryStatus — 合并 embedder + indexer 的状态, 给设置 UI 一站式用.
 */

import { useEffect, useState, useCallback } from "react"
import { embedder, type EmbedderStatus } from "./embedder"
import { indexer, type BackfillState } from "./indexer"
import { chatDB } from "../storage/chatDB"
import {
  getMemoryEnabled,
  setMemoryEnabled,
  getRecallK,
  setRecallK,
  getRecentN,
  setRecentN,
  getMirrorHost,
  setMirrorHost,
} from "./settings"

export interface MemoryStats {
  /** 已索引的消息条数 */
  indexedCount: number
  /** embedding 存储字节估算 */
  storageBytes: number
}

export interface UseMemoryStatusReturn {
  /** 总开关 */
  enabled: boolean
  /** 模型加载/下载状态 */
  modelStatus: EmbedderStatus
  /** 回填进度 */
  backfill: BackfillState
  /** 索引存储统计 */
  stats: MemoryStats
  /** 召回参数 */
  recallK: number
  recentN: number
  modelSource: string

  /** 拨开关; 开启时自动 trigger load() */
  setEnabled: (enabled: boolean) => Promise<void>
  setRecallK: (k: number) => void
  setRecentN: (n: number) => void
  setModelSource: (source: string) => void
  /** 清空所有 embeddings (不删原消息) */
  clearAll: () => Promise<void>
  /** 重试模型加载 (error 状态时) */
  retryLoad: () => Promise<void>
  /** 触发统计刷新 */
  refreshStats: () => Promise<void>
}

export function useMemoryStatus(): UseMemoryStatusReturn {
  const [enabled, setEnabledState] = useState(getMemoryEnabled())
  const [modelStatus, setModelStatus] = useState<EmbedderStatus>(embedder.getStatus())
  const [backfill, setBackfill] = useState<BackfillState>(indexer.getBackfillState())
  const [stats, setStats] = useState<MemoryStats>({ indexedCount: 0, storageBytes: 0 })
  const [recallK, setRecallKState] = useState(getRecallK())
  const [recentN, setRecentNState] = useState(getRecentN())
  const [modelSource, setModelSourceState] = useState(getMirrorHost())

  useEffect(() => {
    const off1 = embedder.subscribe(setModelStatus)
    const off2 = indexer.subscribe(setBackfill)

    // 自动恢复: 用户上次启用过 (localStorage = true), 但 dev 重启 / 页面刷新后
    // embedder 单例回到 idle. 没有这一步, UI 会卡空白 (idle 不命中任何渲染分支).
    if (enabled && embedder.getStatus().kind === "idle") {
      void embedder.load().then(() => {
        // 模型恢复后, 顺手再次回填一下 (indexer 自己 去重 + 不阻塞)
        if (embedder.getStatus().kind === "ready") {
          void chatDB.getAllMessagesAcrossConversations().then(msgs => {
            void indexer.backfill(msgs)
          })
        }
      })
    }

    return () => {
      off1()
      off2()
    }
  }, [enabled])

  const refreshStats = useCallback(async () => {
    const [ids, bytes] = await Promise.all([
      chatDB.getIndexedMessageIds(),
      chatDB.estimateEmbeddingsBytes(),
    ])
    setStats({ indexedCount: ids.size, storageBytes: bytes })
  }, [])

  // 启用 / 回填完成 / clear 后都刷新统计
  useEffect(() => {
    void refreshStats()
  }, [refreshStats, enabled, backfill.active])

  const setEnabled = useCallback(async (next: boolean) => {
    setMemoryEnabled(next)
    setEnabledState(next)
    if (next) {
      // 启用时主动 trigger 加载, 让用户立刻看到下载进度
      if (embedder.getStatus().kind !== "ready") {
        await embedder.load()
      }
      // 加载完成后, 异步回填所有已存历史 (不 await, indexer 内部 subscribe 上报进度)
      if (embedder.getStatus().kind === "ready") {
        void chatDB.getAllMessagesAcrossConversations().then(msgs => {
          void indexer.backfill(msgs)
        })
      }
    }
  }, [])

  const setRecallKAndPersist = useCallback((k: number) => {
    setRecallK(k)
    setRecallKState(k)
  }, [])

  const setRecentNAndPersist = useCallback((n: number) => {
    setRecentN(n)
    setRecentNState(n)
  }, [])

  const setModelSourceAndPersist = useCallback((source: string) => {
    setMirrorHost(source)
    setModelSourceState(getMirrorHost())
  }, [])
  const clearAll = useCallback(async () => {
    await chatDB.clearAllEmbeddings()
    await refreshStats()
  }, [refreshStats])

  const retryLoad = useCallback(async () => {
    await embedder.load()
  }, [])

  return {
    enabled,
    modelStatus,
    backfill,
    stats,
    recallK,
    recentN,
    setEnabled,
    setRecallK: setRecallKAndPersist,
    setRecentN: setRecentNAndPersist,
    modelSource,
    setModelSource: setModelSourceAndPersist,
    clearAll,
    retryLoad,
    refreshStats,
  }
}
