/**
 * diff-store — 每个 ProjectSession 挂一个 diff 状态 store.
 *
 * baseline: 上次 save (或首次 open) 时的 tree snapshot, key = uid.
 * state:    computeDiff(current, baseline) 的最新结果.
 *
 * 关键 invariants:
 *   1. baseline 只在两处被写: 首次 open (setBaseline from initial tree)
 *      和 dirty:true→false 迁移 (save 成功后 setBaseline from committed tree).
 *   2. state 由 setCurrent 触发的纯计算得出, 消费方 subscribe 拿最新值.
 *   3. store 生命周期跟 ProjectSession 一致, WeakMap 让 GC 自动回收.
 */
import { createStore, type StoreApi } from "zustand/vanilla"
import type { MindMapNodeTree } from "simple-mind-map"
import type { ProjectSessionStore } from "@/products/mind/editor-session"
import {
  computeDiff,
  emptyDiffState,
  snapshotTree,
  type DiffState,
  type NodeSnapshot,
} from "./diff-engine"

export interface DiffStoreState {
  baseline: Map<string, NodeSnapshot>
  state: DiffState
  hasBaseline: boolean
  setBaseline: (tree: MindMapNodeTree) => void
  setCurrent: (tree: MindMapNodeTree) => void
  reset: () => void
}

export type DiffStore = StoreApi<DiffStoreState>

export function createDiffStore(): DiffStore {
  return createStore<DiffStoreState>(set => ({
    baseline: new Map(),
    state: emptyDiffState(),
    hasBaseline: false,
    setBaseline: tree => {
      const baseline = snapshotTree(tree)
      set({
        baseline,
        hasBaseline: true,
        state: computeDiff(tree, baseline),
      })
    },
    setCurrent: tree =>
      set(prev => {
        if (!prev.hasBaseline) return prev
        return { state: computeDiff(tree, prev.baseline) }
      }),
    reset: () =>
      set({
        baseline: new Map(),
        state: emptyDiffState(),
        hasBaseline: false,
      }),
  }))
}

/**
 * ProjectSession → DiffStore 的模块级注册表.
 * 每个 session 首次 useDiffStore 时懒创建, session 销毁后 WeakMap 自动清.
 */
const diffStoreBySession = new WeakMap<ProjectSessionStore, DiffStore>()

export function getDiffStore(sessionStore: ProjectSessionStore): DiffStore {
  const existing = diffStoreBySession.get(sessionStore)
  if (existing) return existing
  const created = createDiffStore()
  diffStoreBySession.set(sessionStore, created)
  return created
}
