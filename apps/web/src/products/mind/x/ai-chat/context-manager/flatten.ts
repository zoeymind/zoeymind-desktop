// @ts-nocheck — dormant AI chat / MCP module (bridge.tsx flattens to no-op)
/**
 * flattenTree — 把思维导图的树形结构扁平化为 FlatNode[].
 *
 * 抽出原 MindmapContextManager.flattenTree, 让 Manager 类只做编排.
 *
 * 节点类型约定:
 *   - 根节点 (depth 0)
 *   - icon 含 sign_2 → 模块
 *   - icon 含 priority_* → 用例 (子节点作为步骤收集, 不再递归)
 *   - 其它 → 普通节点
 *
 * 用例节点的子节点 (步骤) 不会作为独立 FlatNode 出现, 只会作为 steps 字段.
 */

import type { MindMapNodeTree } from '../../ai-chat/tools/mindmap/mindmap-node-tree'
import { extractPriorityFromIcons } from '../../ai-chat/tools/mindmap/priority-label'
import type { FlatNode } from './types'

function normalizeText(raw: string): string {
  return raw
    .replace(/\r\n/g, '\\n')
    .replace(/[\r\n]/g, '\\n')
    .trim()
}

export function flattenTree(root: MindMapNodeTree): FlatNode[] {
  const nodes: FlatNode[] = []

  const traverse = (
    node: MindMapNodeTree,
    depth: number,
    parentPath: string,
    parentUid: string | null
  ) => {
    if (!node) return

    const rawText = normalizeText(node.data?.text || '')
    if (!rawText) return

    const uid = node.data?.uid || ''
    const icons: string[] = node.data?.icon || []
    const isModule = icons.includes('sign_2')
    const isCase = icons.some(icon => icon.startsWith('priority_'))
    const isRoot = depth === 0

    let type: FlatNode['type']
    if (isRoot) type = '根节点'
    else if (isModule) type = '模块'
    else if (isCase) type = '用例'
    else if (depth > 0 && parentPath) type = '普通节点'
    else type = '普通节点'

    // 用例节点: 从 icon 提取优先级, 拼到 text 前缀.
    // 这样 ZTDL 输出中用例显示为 C:<id> [P1]用例名.
    const text = isCase ? `[P${extractPriorityFromIcons(icons)}]${rawText}` : rawText

    const currentPath = parentPath ? `${parentPath} > ${rawText}` : rawText
    const childCount = Array.isArray(node.children) ? node.children.length : 0

    // 用例节点的子节点视为步骤, 不再递归
    if (isCase && node.children && Array.isArray(node.children)) {
      const steps = node.children
        .map(child => normalizeText(child?.data?.text || ''))
        .filter(Boolean)

      nodes.push({
        uid,
        parentUid,
        path: currentPath,
        text,
        type,
        depth,
        steps: steps.length > 0 ? steps : undefined,
        childCount
      })
      return
    }

    nodes.push({ uid, parentUid, path: currentPath, text, type, depth, childCount })

    if (node.children && Array.isArray(node.children)) {
      for (const child of node.children) {
        traverse(child, depth + 1, currentPath, uid)
      }
    }
  }

  traverse(root, 0, '', null)
  return nodes
}