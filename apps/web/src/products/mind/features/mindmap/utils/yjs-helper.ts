/**
 * Yjs 辅助函数 - Binary ↔ Tree 转换
 *
 * 节点级 schema：meta / nodes / children（与 packages/simple-mind-map/src/plugins/cooperate/node-tree.js 对齐）
 */

import * as Y from 'yjs'
import { logger } from '@zoeymind/logger'
import { readTreeFromDoc, writeTreeToDoc } from 'simple-mind-map/src/plugins/cooperate/node-tree'

// 思维导图树最少由 data + children 组成
export interface MindmapTreeData {
  data: Record<string, unknown>
  children?: MindmapTreeData[]
}

/**
 * 将各种 Buffer-like 数据转换为真正的 Uint8Array。
 *
 * 后端 Node.js Buffer 通过 tRPC（无 superjson）JSON 序列化后
 * 会变成 { type: "Buffer", data: [byte, ...] } 普通对象，需还原为 Uint8Array 才能被 Yjs 使用。
 */
export function toUint8Array(data: unknown): Uint8Array | null {
  if (!data) return null
  if (data instanceof Uint8Array) return data
  if (data instanceof ArrayBuffer) return new Uint8Array(data)
  if (Array.isArray(data)) return new Uint8Array(data as number[])

  if (typeof data === 'object' && data !== null) {
    const obj = data as { type?: unknown; data?: unknown }
    if (obj.type === 'Buffer' && Array.isArray(obj.data)) {
      return new Uint8Array(obj.data as number[])
    }
  }

  return null
}

/**
 * 将 Yjs V2 二进制数据转换为 JSON 树（节点级 schema）
 */
export function binaryToJson(binary: Uint8Array): MindmapTreeData | null {
  if (!binary || binary.length === 0) return null

  const doc = new Y.Doc()
  try {
    Y.applyUpdateV2(doc, binary)
    return readTreeFromDoc(doc) as MindmapTreeData | null
  } catch (error) {
    logger.error('binaryToJson: 转换失败', error)
    return null
  } finally {
    doc.destroy()
  }
}

/**
 * 尝试将快照数据解码为 JSON 树。
 *
 * 优先 Yjs V2 二进制解码；若失败且数据是 UTF-8 JSON（极旧版本快照），降级 JSON.parse。
 */
export function snapshotDataToJson(raw: unknown): MindmapTreeData | null {
  const binary = toUint8Array(raw)
  if (!binary || binary.length === 0) return null

  const yjsResult = binaryToJson(binary)
  if (yjsResult) return yjsResult

  try {
    const text = new TextDecoder().decode(binary)
    const parsed: unknown = JSON.parse(text)
    if (parsed && typeof parsed === 'object' && 'data' in parsed) {
      logger.debug('snapshotDataToJson: 使用 JSON fallback 解码成功')
      return parsed as MindmapTreeData
    }
    return null
  } catch {
    logger.error('snapshotDataToJson: 所有解码方式均失败')
    return null
  }
}

/**
 * 将 JSON 对象转换为 Yjs V2 二进制数据（节点级 schema）
 */
export function jsonToBinary(treeData: MindmapTreeData): Uint8Array {
  const doc = new Y.Doc()
  try {
    writeTreeToDoc(doc, treeData, undefined)
    return Y.encodeStateAsUpdateV2(doc)
  } finally {
    doc.destroy()
  }
}
