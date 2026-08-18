/**
 * 快照数据归一化：新格式（节点树）直接使用，旧格式（扁平对象）走
 * `transformObjectToTreeData` 转换。
 *
 * 之前在 `CloudSnapshotPanel` 和 `SnapshotPreviewModal` 各有一份完全相同的实现，
 * 已统一到这里，避免后续维护脱节。
 */
import { transformObjectToTreeData } from 'simple-mind-map'
import type { MindMapNodeTree } from 'simple-mind-map'
import { logger } from '@zoeymind/logger'

export type SnapshotDataInput = MindMapNodeTree | Record<string, unknown> | null | undefined

/** 新格式特征：有 `data.uid` 且 `children` 为数组。 */
export function isTreeStructure(data: SnapshotDataInput): data is MindMapNodeTree {
  if (!data || typeof data !== 'object') return false
  const tree = data as MindMapNodeTree
  return Boolean(
    tree.data && typeof tree.data === 'object' && tree.data.uid && Array.isArray(tree.children)
  )
}

/**
 * 把任意来源的快照数据归一化为 `MindMapNodeTree`。
 * 不是合法数据时返回 `null`。
 */
export function convertSnapshotToTreeData(data: SnapshotDataInput): MindMapNodeTree | null {
  if (!data) return null
  if (isTreeStructure(data)) {
    logger.debug('快照数据已是树结构，无需转换')
    return data
  }
  logger.debug('快照数据是旧格式，进行转换')
  return transformObjectToTreeData(data)
}
