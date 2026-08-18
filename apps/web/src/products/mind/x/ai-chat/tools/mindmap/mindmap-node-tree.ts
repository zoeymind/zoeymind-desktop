// @ts-nocheck — dormant AI chat / MCP module (bridge.tsx flattens to no-op)
/**
 * 思维导图工具的辅助函数
 */

import type MindMap from 'simple-mind-map'
import type { MindMapNodeTree } from 'simple-mind-map'
export type { MindMapNodeTree }

const snapshotCache = new WeakMap<MindMap, MindMapNodeTree | null>()
const snapshotListenerRegistry = new WeakSet<MindMap>()

const registerSnapshotInvalidators = (mindMap: MindMap) => {
  if (snapshotListenerRegistry.has(mindMap)) {
    return
  }

  const invalidate = () => {
    snapshotCache.delete(mindMap)
  }

  mindMap.on('data_change', invalidate)
  mindMap.on('set_data', invalidate)
  mindMap.on('update_data', invalidate)

  snapshotListenerRegistry.add(mindMap)
}

/**
 * 获取 MindMap 数据快照（带缓存）
 *
 * 复用 getData 的结果，避免同一帧内重复触发深拷贝。
 * 数据变更事件触发时会自动失效。
 */
export const getMindMapSnapshot = (mindMap: MindMap): MindMapNodeTree | null => {
  if (!mindMap) {
    return null
  }

  registerSnapshotInvalidators(mindMap)

  if (!snapshotCache.has(mindMap)) {
    const snapshot = mindMap.getData()
    snapshotCache.set(mindMap, snapshot)
  }

  return snapshotCache.get(mindMap) ?? null
}

export interface MindMapNodeIndexEntry {
  node: MindMapNodeTree
  parent: MindMapNodeTree | null
}

/**
 * 构建 uid -> 节点 的索引，便于批量编辑时 O(1) 查找
 */
export const buildMindMapUidIndex = (root: MindMapNodeTree): Map<string, MindMapNodeIndexEntry> => {
  const index = new Map<string, MindMapNodeIndexEntry>()
  if (!root) return index

  const stack: Array<{ node: MindMapNodeTree; parent: MindMapNodeTree | null }> = [
    { node: root, parent: null }
  ]

  while (stack.length) {
    const { node, parent } = stack.pop()!
    const uid = node?.data?.uid
    if (uid) {
      index.set(uid, { node, parent })
    }

    if (node?.children && Array.isArray(node.children)) {
      for (let i = node.children.length - 1; i >= 0; i--) {
        stack.push({ node: node.children[i], parent: node })
      }
    }
  }

  return index
}

/**
 * 从完整数据中递归查找节点（包括折叠的节点）
 *
 * @param mindMap - 思维导图实例
 * @param uid - 节点UID
 * @returns 节点树数据，如果未找到返回 null
 */
export function findNodeByUid(mindMap: MindMap, uid: string): MindMapNodeTree | null {
  try {
    // 使用缓存的快照获取完整的数据结构（包含折叠节点）
    const allData = getMindMapSnapshot(mindMap)

    if (!allData) return null

    // 递归查找指定 uid 的节点
    const traverse = (node: MindMapNodeTree): MindMapNodeTree | null => {
      if (!node) return null

      if (node.data?.uid === uid) {
        return node
      }

      if (node.children && Array.isArray(node.children)) {
        for (const child of node.children) {
          const found = traverse(child)
          if (found) return found
        }
      }

      return null
    }

    return traverse(allData)
  } catch {
    return null
  }
}

/**
 * 递归遍历思维导图数据树
 *
 * @param node - 起始节点
 * @param callback - 每个节点的回调函数，返回 true 停止遍历
 */
export function traverseNodeTree(
  node: MindMapNodeTree,
  callback: (node: MindMapNodeTree) => boolean | void
): void {
  if (!node) return

  const shouldStop = callback(node)
  if (shouldStop === true) return

  if (node.children && Array.isArray(node.children)) {
    for (const child of node.children) {
      traverseNodeTree(child, callback)
    }
  }
}