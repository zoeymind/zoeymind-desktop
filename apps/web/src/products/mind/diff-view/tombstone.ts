/**
 * tombstone —— 软删除机制.
 *
 * 用户按 Delete/Backspace/Shift+Backspace/Ctrl+X 时, 引擎会走 REMOVE_NODE /
 * REMOVE_CURRENT_NODE / CUT_NODE. 我们在 app 层替换这三个 handler:
 *   soft 版本 → 给节点及其整个子树打 data.pendingDelete = true, 不真拆树.
 *   原 handler 仅保留用于卸载时恢复.

 * 视觉侧: diff-engine 把 pendingDelete=true 归到 removedUids, useDiffTracking
 *        据此给节点 group 打 .smm-diff-tombstone class (透明 + 红边 + 禁交互).
 *
 * 保存事务 prepare 阶段只从持久化快照剪掉 tombstone，不碰 live tree；
 * 文件和索引都成功后，commitTombstones() 才同步剪掉 live tree。
 *
 * Undo: 引擎 addHistory 在 exec 结束后跑, 软删也会入历史; Ctrl+Z 恢复上一版
 *      tree data (pendingDelete=false), 节点回到正常状态.
 */
import type MindMap from "simple-mind-map"
import type { MindMapNodeData, MindMapNodeTree } from "simple-mind-map"

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
  paste?: () => Promise<void> | void
  beingCopyData?: unknown
}

interface MindMapInternal {
  command: RemovableCommand
  renderer: RendererLike
  emit?: (event: string, ...args: unknown[]) => void
  render?: () => void
  execCommand?: (name: string, ...args: unknown[]) => void
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

  // 原 handler 保存为 __HARD_* 以备恢复.
  cmd.add(HARD_REMOVE_NODE, origRemove)
  cmd.add(HARD_REMOVE_CURRENT_NODE, origRemoveCurrent)
  cmd.add(HARD_CUT_NODE, origCut)

  // 装饰 renderer.paste: cut 刚存的 beingCopyData 优先, 用完清空.
  // 目的: Tauri 环境下 navigator.clipboard.read 可能因权限静默失败,
  //   engine 原生 paste 在 read 失败后不 fallback 到 beingCopyData,
  //   导致本地 cut → paste 无效. 装饰器让本地 cut+paste 走内存直通.
  //   beingCopyData 用完清空, 下一次 paste 回到 engine 原生 (若来自外部
  //   剪贴板 / 未来装了 clipboard plugin, 仍能正常读).
  const renderer = internal.renderer
  const origPaste = renderer.paste?.bind(renderer)
  const softPaste = async () => {
    if (renderer.beingCopyData) {
      const data = renderer.beingCopyData
      renderer.beingCopyData = undefined
      internal.execCommand?.("PASTE_NODE", data)
      return
    }
    if (origPaste) await origPaste()
  }
  if (origPaste) renderer.paste = softPaste

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
    if (origPaste) renderer.paste = origPaste
    internal[SOFT_INSTALLED_FLAG] = false
  }
}

/**
 * 生成不含 tombstone 的持久化树。只修改传入快照，不触碰 live renderer。
 */
export function pruneTombstonesFromSnapshot(tree: MindMapNodeTree): MindMapNodeTree {
  pruneTombstonedFromDataTree(tree as NodeInternal)
  return tree
}

/**
 * 持久化成功后的内存提交：从 live renderer 剪掉 tombstone。
 * 必须只由 save transaction 的 commit 阶段调用。
 */
export function commitTombstones(mindMap: MindMap): void {
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
 * softCut —— Ctrl+X 剪切: 装饰而非替换.
 *   1. 深拷贝整棵子树数据 (含子孙) → 送剪贴板, Ctrl+V 拿到完整数据.
 *   2. 剥掉 uid / isActive / pendingDelete (paste 时 engine 会生成新 uid).
 *   3. 原节点整棵子树保留为 tombstone，保存事务 commit 后统一真删.
 *
 * 关键 bug 修: 之前 copyData 只放顶层 { data, children: [] }, 子树数据丢了,
 *   Ctrl+V 只贴出光秃秃的一个节点. 现在深拷贝完整数据树.
 */
function softCut(mindMap: MindMapInternal, callback: ((data: unknown) => void) | undefined): void {
  const active = mindMap.renderer.activeNodeList ?? []
  if (active.length === 0) return
  const topLevel = active.filter(node => !node.isRoot)
  if (topLevel.length === 0) return

  const copyData = topLevel.map(cleanCopyDataTree)

  for (const node of topLevel) markSubtreePendingDelete(node)

  mindMap.renderer.clearActiveNodeList?.()
  mindMap.emit?.("node_active", null, [])
  mindMap.render?.()

  if (typeof callback === "function") callback(copyData)
}

interface CopyDataTree {
  data: Record<string, unknown>
  children: CopyDataTree[]
}

/**
 * 从 MindMapNode 实例或 data-tree 节点递归 clone 成 { data, children } 结构.
 * 复制过程中剥掉 uid (paste 时 engine 会重生成) / isActive / pendingDelete.
 */
function cleanCopyDataTree(node: NodeInternal): CopyDataTree {
  const rawData = node.nodeData?.data ?? node.data ?? {}
  const clonedData = JSON.parse(JSON.stringify(rawData)) as Record<string, unknown>
  delete clonedData.uid
  delete clonedData.isActive
  delete clonedData.pendingDelete
  const rawChildren = node.nodeData?.children ?? node.children ?? []
  return {
    data: clonedData,
    children: rawChildren.map(cleanCopyDataTree),
  }
}

function markSubtreePendingDelete(node: NodeInternal): void {
  const data = node.nodeData?.data ?? node.data
  if (data) (data as MindMapNodeData).pendingDelete = true
  // 走数据树 (nodeData.children 或 data-tree node 的 children), 不走实例 children —
  // 折叠节点的 .children (实例) 为空, 用实例会漏掉折叠子树里的节点, 展开后
  // 那些节点没有 pendingDelete, CSS class 也就打不上. 数据树包含全部后代.
  const children = node.nodeData?.children ?? node.children
  if (Array.isArray(children)) for (const child of children) markSubtreePendingDelete(child)
}
