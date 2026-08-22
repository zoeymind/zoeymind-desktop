/**
 * useDiffTracking —— 把 mindmap 引擎事件接进 diff store, 并把 diff 状态映射到
 * 每个渲染节点的 group SVG 元素的 CSS class 上 (smm-diff-add / -modify / -move).
 *
 * 生命周期:
 *   mount:
 *     - 首次 initial tree → diffStore.setBaseline(initial)
 *     - 挂 mindMap.on("data_change") → diffStore.setCurrent(current)
 *     - 注册 save participant：prepare 生成持久化快照，commit 统一更新 live tree
 *       和 diff baseline
 *     - 挂 mindMap.on("node_tree_render_end") → 同步 class 到 SVG group
 *   unmount:
 *     - 卸载 listener, 清 CSS class
 *
 * tombstone 节点保留在画布中并映射为 removedUids，保存事务成功后才移除。
 */
import { useEffect, useMemo } from "react"
import { useStore } from "zustand"
import type { MindMapNodeTree } from "simple-mind-map"
import {
  useProjectMindMapStore as useMindMapStore,
  useProjectSessionStore,
} from "@/products/mind/editor-session"
import { useSaveFlowContext } from "@/shared/native"
import type { BundleSource } from "@/shared/native/save-flow"
import type { SaveParticipant } from "@/shared/native/save-transaction"
import { getDiffStore } from "./diff-store"
import type { DiffState } from "./diff-engine"
import { commitTombstones, installSoftDelete, pruneTombstonesFromSnapshot } from "./tombstone"

const CLASS_ADD = "smm-diff-add"
const CLASS_MODIFY = "smm-diff-modify"
const CLASS_MOVE = "smm-diff-move"
const CLASS_TOMBSTONE = "smm-diff-tombstone"

interface NodeGroupLike {
  addClass: (name: string) => unknown
  removeClass: (name: string) => unknown
  node?: SVGElement
}

interface RenderedNodeLike {
  uid?: string
  group?: NodeGroupLike | null
  children?: RenderedNodeLike[]
}

interface RendererLike {
  root?: RenderedNodeLike | null
}

interface MindMapWithRenderer {
  renderer?: RendererLike | null
}

/** 主 hook: 在 MindMapCanvas 里挂一次即可. */
export function useDiffTracking(): void {
  const { mindMap } = useMindMapStore()
  const sessionStore = useProjectSessionStore()
  const diffStore = getDiffStore(sessionStore)
  const saveFlow = useSaveFlowContext()
  const saveParticipant = useMemo<SaveParticipant | null>(() => {
    if (!mindMap) return null
    return {
      prepare: (source: BundleSource) => {
        pruneTombstonesFromSnapshot(source.tree)
        return {
          source,
          commit: () => {
            commitTombstones(mindMap)
            const tree = mindMap.getData() as MindMapNodeTree
            diffStore.getState().setBaseline(tree)
          },
        }
      },
    }
  }, [mindMap, diffStore])

  // baseline + data_change 挂钩
  useEffect(() => {
    if (!mindMap) return

    const initialTree = mindMap.getData() as MindMapNodeTree
    diffStore.getState().setBaseline(initialTree)

    const onDataChange = () => {
      const tree = mindMap.getData() as MindMapNodeTree
      diffStore.getState().setCurrent(tree)
    }
    mindMap.on?.("data_change", onDataChange)

    return () => {
      mindMap.off?.("data_change", onDataChange)
      diffStore.getState().reset()
    }
  }, [mindMap, diffStore])

  // 保存事务参与者：prepare 只剪持久化快照；真正成功后才统一提交
  // live tombstone 和 diff baseline。写盘失败时二者均保持不变。
  useEffect(() => {
    if (!saveParticipant) return
    return saveFlow.registerSaveParticipant(saveParticipant)
  }, [saveFlow, saveParticipant])

  // 软删除: 拦截 REMOVE_NODE, 只打 pendingDelete=true; 保存 commit 才真删.
  useEffect(() => {
    if (!mindMap) return
    return installSoftDelete(mindMap)
  }, [mindMap])

  // diff 状态 → SVG group CSS class 同步. 每次 diff 变或每次 render 完都跑.
  useEffect(() => {
    if (!mindMap) return

    const syncClasses = (state: DiffState) => {
      const root = (mindMap as MindMapWithRenderer).renderer?.root
      if (!root) return
      forEachRenderedNode(root, node => {
        const group = node.group
        if (!group) return
        const uid = node.uid
        // 每次全量 reset 三个 diff class, 再按 state 加回. 引擎自身的
        // active / dragging / highlight 不属于这三个 class, 不受影响.
        group.removeClass(CLASS_ADD)
        group.removeClass(CLASS_MODIFY)
        group.removeClass(CLASS_MOVE)
        group.removeClass(CLASS_TOMBSTONE)
        if (!uid) return
        if (group.node) group.node.dataset.uid = uid
        if (state.addedUids.has(uid)) group.addClass(CLASS_ADD)
        if (state.modifiedUids.has(uid)) group.addClass(CLASS_MODIFY)
        if (state.movedUids.has(uid)) group.addClass(CLASS_MOVE)
        // tombstoned 节点保留在树里, uid 命中 removedUids
        if (state.removedUids.has(uid)) group.addClass(CLASS_TOMBSTONE)
      })
    }

    // 立即同步一次
    syncClasses(diffStore.getState().state)

    // diff state 变化时同步
    const unsubDiff = diffStore.subscribe(next => {
      syncClasses(next.state)
    })

    // 引擎重渲染完成也要同步一次 (新 group 是全新元素, class 不会自动继承)
    const onRenderEnd = () => syncClasses(diffStore.getState().state)
    mindMap.on?.("node_tree_render_end", onRenderEnd)

    return () => {
      unsubDiff()
      mindMap.off?.("node_tree_render_end", onRenderEnd)
    }
  }, [mindMap, diffStore])
}

function forEachRenderedNode(
  node: RenderedNodeLike,
  visit: (node: RenderedNodeLike) => void
): void {
  visit(node)
  const children = Array.isArray(node.children) ? node.children : []
  for (const child of children) forEachRenderedNode(child, visit)
}

/** 供 DiffSummary 之外的消费方直接读 diff 状态. */
export function useDiffState(): DiffState {
  const sessionStore = useProjectSessionStore()
  const diffStore = getDiffStore(sessionStore)
  return useStore(diffStore, s => s.state)
}
