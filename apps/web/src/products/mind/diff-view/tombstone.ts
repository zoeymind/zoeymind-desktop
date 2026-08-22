/**
 * tombstone —— 软删除机制.
 *
 * 用户按 Delete/Backspace/Shift+Backspace/Ctrl+X 时, 引擎会走 REMOVE_NODE /
 * REMOVE_CURRENT_NODE / CUT_NODE. 我们在 app 层替换这三个 handler:
 *   soft 版本 → 给节点及其整个子树打 data.pendingDelete = true, 不真拆树.
 *   原 handler 保存为 __HARD_* 供 flush 时复用.
 *
 * 视觉侧: diff-engine 把 pendingDelete=true 归到 removedUids, useDiffTracking
 *        据此给节点 group 打 .smm-diff-tombstone class (透明 + 红边 + 禁交互).
 *
 * 保存时 flushTombstones() 直接在 renderer.renderTree 上剪掉这些子树, 然后
 * setData+render+commitHistoryNow 让 useStorageManager 同步 state.source,
 * 紧接的 writeBundle 拿到干净树.
 *
 * Undo: 引擎 addHistory 在 exec 结束后跑, 软删也会入历史; Ctrl+Z 恢复上一版
 *      tree data (pendingDelete=false), 节点回到正常状态.
 */
import type MindMap from "simple-mind-map"
import type { MindMapNodeData } from "simple-mind-map"

const SOFT_INSTALLED_FLAG = "__zoeymind_soft_delete_installed"
const HARD_REMOVE_NODE = "__HARD_REMOVE_NODE"
const HARD_REMOVE_CURRENT_NODE = "__HARD_REMOVE_CURRENT_NODE"
const HARD_CUT_NODE = "__HARD_CUT_NODE"

interface RemovableCommand {
  add: (name: string, fn: (...args: unknown[]) => void) => void
  remove: (name: string, fn?: (...args: unknown[]) => void) => void
  commands: Record<string, Array<(...args: unknown[]) => void>>
  commitHistoryNow?: () => void
}

interface RendererLike {
  activeNodeList?: NodeInternal[]
  clearActiveNodeList?: () => void
  root?: NodeInternal | null
  renderTree?: NodeInternal | null
  setData?: (data: NodeInternal | null) => void
}

interface MindMapInternal {
  command: RemovableCommand
  renderer: RendererLike
  emit?: (event: string, ...args: unknown[]) => void
  render?: () => void
  [key: string]: unknown
}

interface NodeInternal {
  isRoot?: boolean
  data?: Record<string, unknown>
  nodeData?: {
    data?: Record<string, unknown>
    children?: NodeInternal[]
  }
  children?: NodeInternal[]
}

/**
 * 在 mindMap 实例上安装软删除. 幂等: 已安装过则跳过.
 * 返回 uninstall 函数, 卸载时恢复原 handler.
 */
export function installSoftDelete(mindMap: MindMap): () => void {
  const internal = mindMap as unknown as MindMapInternal
  if (internal[SOFT_INSTALLED_FLAG]) return () => undefined

  const cmd = internal.command
  const origRemove = cmd.commands["REMOVE_NODE"]?.[0]
  const origRemoveCurrent = cmd.commands["REMOVE_CURRENT_NODE"]?.[0]
  const origCut = cmd.commands["CUT_NODE"]?.[0]
  if (!origRemove || !origRemoveCurrent || !origCut) return () => undefined

  // 原 handler 保存为 __HARD_* 以备恢复; flush 走 renderTree 直接剪, 不再复用.
  cmd.add(HARD_REMOVE_NODE, origRemove)
  cmd.add(HARD_REMOVE_CURRENT_NODE, origRemoveCurrent)
  cmd.add(HARD_CUT_NODE, origCut)

  const softRemoveNode = (...args: unknown[]) => {
    softRemove(internal, (args[0] as NodeInternal[] | undefined) ?? undefined)
  }
  const softRemoveCurrentNode = (...args: unknown[]) => {
    softRemove(internal, (args[0] as NodeInternal[] | undefined) ?? undefined)
  }
  const softCutNode = (...args: unknown[]) => {
    softCut(internal, args[0] as ((data: unknown) => void) | undefined)
  }

  cmd.remove("REMOVE_NODE", origRemove)
  cmd.remove("REMOVE_CURRENT_NODE", origRemoveCurrent)
  cmd.remove("CUT_NODE", origCut)
  cmd.add("REMOVE_NODE", softRemoveNode)
  cmd.add("REMOVE_CURRENT_NODE", softRemoveCurrentNode)
  cmd.add("CUT_NODE", softCutNode)
  internal[SOFT_INSTALLED_FLAG] = true

  return () => {
    cmd.remove("REMOVE_NODE", softRemoveNode)
    cmd.remove("REMOVE_CURRENT_NODE", softRemoveCurrentNode)
    cmd.remove("CUT_NODE", softCutNode)
    cmd.remove(HARD_REMOVE_NODE)
    cmd.remove(HARD_REMOVE_CURRENT_NODE)
    cmd.remove(HARD_CUT_NODE)
    cmd.add("REMOVE_NODE", origRemove)
    cmd.add("REMOVE_CURRENT_NODE", origRemoveCurrent)
    cmd.add("CUT_NODE", origCut)
    internal[SOFT_INSTALLED_FLAG] = false
  }
}

/**
 * 保存前调用: 直接在 renderer.renderTree 上剪掉所有 pendingDelete=true 的子树,
 * 然后 setData+render+commitHistoryNow 让 useStorageManager 同步 state.source,
 * 保证紧接的 writeBundle 拿到干净树.
 *
 * 不走 execCommand("REMOVE_NODE") 是因为它依赖 activeNodeList 和 target.parent
 * 引用, uid 匹配任一步漂移就静默失败.
 */
export function flushTombstones(mindMap: MindMap): void {
  const internal = mindMap as unknown as MindMapInternal
  const renderTree = internal.renderer.renderTree
  if (!renderTree) return
  const removed = pruneTombstonedFromDataTree(renderTree)
  if (removed === 0) return
  internal.renderer.setData?.(renderTree)
  internal.render?.()
  internal.command.commitHistoryNow?.()
}

/** 递归剪掉所有 data.pendingDelete=true 的子树, 返回剪掉的数量. */
function pruneTombstonedFromDataTree(node: NodeInternal): number {
  const children = node.children
  if (!Array.isArray(children)) return 0
  let removed = 0
  for (let i = children.length - 1; i >= 0; i -= 1) {
    const child = children[i]!
    if (child.data?.pendingDelete === true) {
      children.splice(i, 1)
      removed += 1
      continue
    }
    removed += pruneTombstonedFromDataTree(child)
  }
  return removed
}

// ————— soft handlers —————

function softRemove(mindMap: MindMapInternal, appointed: NodeInternal[] | undefined): void {
  const active = mindMap.renderer.activeNodeList ?? []
  const targets = appointed && appointed.length > 0 ? appointed : active
  if (targets.length === 0) return
  for (const node of targets) {
    if (node.isRoot) continue
    markSubtreePendingDelete(node)
  }
  mindMap.renderer.clearActiveNodeList?.()
  mindMap.emit?.("node_active", null, [])
  mindMap.render?.()
}

/**
 * softCut —— Ctrl+X 剪切: 数据仍复制到剪贴板 (剪切板拿的是 pending 前的数据),
 * 原节点走 tombstone, 保存时统一 flush.
 */
function softCut(mindMap: MindMapInternal, callback: ((data: unknown) => void) | undefined): void {
  const active = mindMap.renderer.activeNodeList ?? []
  if (active.length === 0) return
  const topLevel = active.filter(node => !node.isRoot)
  if (topLevel.length === 0) return

  const copyData = topLevel.map(node => {
    const data = node.nodeData?.data ?? node.data ?? {}
    const cloned = JSON.parse(JSON.stringify(data)) as MindMapNodeData
    delete cloned.pendingDelete
    return { data: cloned, children: [] }
  })

  for (const node of topLevel) markSubtreePendingDelete(node)

  mindMap.renderer.clearActiveNodeList?.()
  mindMap.emit?.("node_active", null, [])
  mindMap.render?.()

  if (typeof callback === "function") callback(copyData)
}

function markSubtreePendingDelete(node: NodeInternal): void {
  const data = node.nodeData?.data ?? node.data
  if (data) (data as MindMapNodeData).pendingDelete = true
  const children = node.children
  if (Array.isArray(children)) for (const child of children) markSubtreePendingDelete(child)
}
