// @ts-nocheck — desktop mirror of cloud AI chat; runtime bridged via bridge.tsx
/**
 * 思维导图上下文管理器
 *
 * 核心职责：
 * 1. 将思维导图树形结构序列化为 AI 可理解的结构化文本
 * 2. 维护快照，对比变更并生成增量更新
 * 3. 输出格式让 AI 明确知道这是「用户当前正在编辑的思维导图的实时状态」
 *
 * 节点类型约定：
 *   - 根节点：整棵思维导图的标题
 *   - icon 包含 sign_2 的节点：测试模块
 *   - icon 包含 priority_* 的节点：测试用例，其子节点为用例步骤
 *   - 其他节点：普通节点
 */

import type MindMap from 'simple-mind-map'
import { getMindMapSnapshot, type MindMapNodeTree } from './tools/mindmap/mindmap-node-tree'
import {
  ztdlModule,
  ztdlCase,
  ztdlPrefix,
  ztdlAdd,
  ztdlRemove,
  ztdlModify,
  ztdlMove,
  ztdlCopy
} from './tools/mindmap/ztdl-compiler'
import { SessionIdMapper, type MapperState } from './tools/session-id-mapper'
import { logger } from '@zoeymind/logger'
import { flattenTree } from './context-manager/flatten'
import { estimateTokens } from './context-manager/tokens'
import type { FlatNode, StructuralChange, SnapshotData, DiffStats } from './context-manager/types'
export type { SnapshotData, DiffStats } from './context-manager/types'

/** 配置常量（可通过环境变量覆盖） */
const CONFIG = {
  /** Token 警告阈值（超过此值会输出警告日志） */
  TOKEN_WARNING_THRESHOLD:
    typeof import.meta !== 'undefined' && import.meta.env?.VITE_MINDMAP_TOKEN_WARNING_THRESHOLD
      ? Number(import.meta.env.VITE_MINDMAP_TOKEN_WARNING_THRESHOLD)
      : 50000,
  /** diff 变更数量阈值（超过此值可能影响性能） */
  DIFF_CHANGE_THRESHOLD:
    typeof import.meta !== 'undefined' && import.meta.env?.VITE_MINDMAP_DIFF_CHANGE_THRESHOLD
      ? Number(import.meta.env.VITE_MINDMAP_DIFF_CHANGE_THRESHOLD)
      : 100
} as const

export class MindmapContextManager {
  private mindMap: MindMap
  private lastSnapshot: SnapshotData | null = null
  private currentVersion = 0
  readonly idMapper = new SessionIdMapper()

  constructor(mindMap: MindMap) {
    this.mindMap = mindMap
  }

  /** 将思维导图树扁平化为节点列表 (委托给 ./context-manager/flatten) */
  private flattenTree(root: MindMapNodeTree): FlatNode[] {
    return flattenTree(root)
  }

  /**
   * 将节点列表格式化为 ZTDL 格式（Zoey Test DSL）
   *
   * 调用统一编译器的原子函数：ztdlModule / ztdlCase
   */
  private formatFullContext(nodes: FlatNode[]): string {
    if (nodes.length === 0) return '(empty)'

    const lines: string[] = []

    for (const node of nodes) {
      if (node.type === '根节点') {
        lines.push(node.text)
        continue
      }

      const indent = '  '.repeat(Math.max(0, node.depth - 1))

      if (node.type === '模块') {
        lines.push(ztdlModule(this.idMapper.shorten(node.uid), node.text, indent))
      } else if (node.type === '用例') {
        lines.push(ztdlCase(this.idMapper.shorten(node.uid), node.text, node.steps || [], indent))
      } else {
        lines.push(`${indent}${node.text}`)
      }
    }

    return lines.join('\n')
  }

  /**
   * 检测结构性变更（MOVE / COPY）
   *
   * MOVE 检测逻辑：同一个 uid 在新旧快照中都存在，但 parentUid 发生了变化
   * COPY 检测逻辑：新增的节点集合中，存在与旧快照中某节点 text + type + childCount 完全一致的节点（uid 不同）
   *
   * 注意：uid Map 由调用方传入，避免重复构建
   */
  private detectStructuralChanges(
    oldNodes: FlatNode[],
    newNodes: FlatNode[],
    addedNodes: FlatNode[],
    removedNodes: FlatNode[],
    oldByUid: Map<string, FlatNode>,
    newByUid: Map<string, FlatNode>
  ): StructuralChange[] {
    const changes: StructuralChange[] = []

    // --- MOVE 检测 ---
    // 找出 uid 相同但 parentUid 变化的节点
    const movedUids = new Set<string>()
    for (const [uid, newNode] of newByUid) {
      const oldNode = oldByUid.get(uid)
      if (oldNode && oldNode.parentUid !== newNode.parentUid) {
        movedUids.add(uid)
        const fromParent = oldNode.parentUid ? oldByUid.get(oldNode.parentUid) : null
        const toParent = newNode.parentUid ? newByUid.get(newNode.parentUid) : null
        changes.push({
          type: 'MOVE',
          nodeUid: uid,
          nodeText: newNode.text,
          nodeType: newNode.type,
          fromUid: oldNode.parentUid,
          fromText: fromParent?.text || '根节点',
          toUid: newNode.parentUid,
          toText: toParent?.text || '根节点'
        })
      }
    }

    // --- COPY 检测 ---
    // 在新增节点中查找与旧节点内容匹配的"副本"
    // 策略：新增节点的 uid 在旧快照中不存在，但其 text+type 与某个旧节点完全一致
    if (addedNodes.length > 0 && removedNodes.length === 0) {
      // 构建旧节点的 text+type 指纹索引
      const oldFingerprints = new Map<string, FlatNode>()
      for (const node of oldNodes) {
        if (node.uid) {
          const fingerprint = `${node.text}||${node.type}||${node.childCount}`
          oldFingerprints.set(fingerprint, node)
        }
      }

      // 只检查顶层新增节点（非被 MOVE 影响的子节点），避免将 MOVE 子节点误判为 COPY
      const addedTopLevel = addedNodes.filter(
        n => n.uid && !movedUids.has(n.uid) && !movedUids.has(n.parentUid || '')
      )

      for (const addedNode of addedTopLevel) {
        const fingerprint = `${addedNode.text}||${addedNode.type}||${addedNode.childCount}`
        const sourceNode = oldFingerprints.get(fingerprint)

        if (sourceNode && sourceNode.uid !== addedNode.uid) {
          // 统计副本下的用例数量
          const copiedSubtreeNodes = newNodes.filter(
            n => n.path.startsWith(`${addedNode.path} > `) || n.path === addedNode.path
          )
          const copiedCaseCount = copiedSubtreeNodes.filter(n => n.type === '用例').length

          const targetParent = addedNode.parentUid ? newByUid.get(addedNode.parentUid) : null
          changes.push({
            type: 'COPY',
            nodeUid: addedNode.uid,
            nodeText: addedNode.text,
            nodeType: addedNode.type,
            fromUid: null,
            fromText: sourceNode.text,
            toUid: addedNode.parentUid,
            toText: targetParent?.text || '根节点',
            copiedCaseCount,
            copiedNodeCount: copiedSubtreeNodes.length
          })
        }
      }
    }

    return changes
  }

  /**
   * 将结构变更格式化为 ZTDL diff 操作符（调用统一编译器）
   */
  private formatStructuralChanges(changes: StructuralChange[]): string[] {
    const lines: string[] = []

    for (const change of changes) {
      if (!ztdlPrefix(change.nodeType)) continue // 普通节点不输出结构变更

      if (change.type === 'MOVE') {
        const shortId = this.shortenStructural(change.nodeType, change.nodeUid)
        const fromShort = change.fromUid ? this.shortenParent(change.fromUid) : 'root'
        const toShort = change.toUid ? this.shortenParent(change.toUid) : 'root'
        lines.push(ztdlMove(change.nodeType, shortId, fromShort, toShort))
      } else if (change.type === 'COPY') {
        const shortId = this.shortenStructural(change.nodeType, change.nodeUid)
        const fromRef = change.fromUid ? this.shortenParent(change.fromUid) : change.fromText
        const toShort = change.toUid ? this.shortenParent(change.toUid) : 'root'
        lines.push(ztdlCopy(change.nodeType, shortId, fromRef, toShort, change.copiedCaseCount))
      }
    }

    return lines
  }

  /**
   * 检测两个同一节点（uid 相同）之间的内容变化
   */
  private detectContentChanges(oldNode: FlatNode, newNode: FlatNode): string[] {
    const changes: string[] = []

    // 检查文本变化
    if (oldNode.text !== newNode.text) {
      changes.push(`name=${newNode.text}`)
    }

    // 检查步骤变化
    const oldSteps = (oldNode.steps || []).join('|')
    const newSteps = (newNode.steps || []).join('|')
    if (oldSteps !== newSteps) {
      if (newNode.steps && newNode.steps.length > 0) {
        changes.push(`steps={${newNode.steps.join('|')}}`)
      } else if (oldNode.steps && oldNode.steps.length > 0) {
        changes.push('steps={}')
      }
    }

    return changes
  }

  /**
   * 将 detectContentChanges 的结果拼接为 ZTDL 修改属性字符串
   */
  private joinModifyAttrs(changes: string[]): string {
    return changes.join(' ')
  }

  /**
   * 对比两次快照，生成自然语言变更描述
   *
   * 增强：支持检测结构性变更（MOVE / COPY），不再将"移动"误判为"删除+新增"
   */
  private generateDiff(
    oldNodes: FlatNode[],
    newNodes: FlatNode[]
  ): { text: string | null; stats?: DiffStats } {
    // 构建 uid -> node 映射（用于结构检测）
    const oldByUid = new Map<string, FlatNode>()
    for (const node of oldNodes) {
      if (node.uid) oldByUid.set(node.uid, node)
    }

    const newByUid = new Map<string, FlatNode>()
    for (const node of newNodes) {
      if (node.uid) newByUid.set(node.uid, node)
    }

    // 构建 path -> node 映射（兼容原有逻辑）
    const oldMap = new Map<string, FlatNode>()
    for (const node of oldNodes) {
      oldMap.set(node.path, node)
    }

    const newMap = new Map<string, FlatNode>()
    for (const node of newNodes) {
      newMap.set(node.path, node)
    }

    // --- 先检测结构变更，标记已处理的 uid ---
    const rawAdded: FlatNode[] = []
    const rawRemoved: FlatNode[] = []

    // 基于 path 找出新增和删除
    for (const [path, node] of newMap) {
      if (!oldMap.has(path)) rawAdded.push(node)
    }
    for (const [path, node] of oldMap) {
      if (!newMap.has(path)) rawRemoved.push(node)
    }

    // 检测结构变更（复用已构建的 uid Map，避免重复构建）
    const structuralChanges = this.detectStructuralChanges(
      oldNodes,
      newNodes,
      rawAdded,
      rawRemoved,
      oldByUid,
      newByUid
    )

    // 收集被结构变更解释的 uid，从 added/removed 中排除
    const movedUids = new Set<string>()
    const copiedUids = new Set<string>()
    for (const change of structuralChanges) {
      if (change.type === 'MOVE') {
        // 找到移动节点的 uid 及其所有子节点
        for (const [uid, node] of newByUid) {
          if (
            node.text === change.nodeText &&
            node.type === change.nodeType &&
            oldByUid.has(uid) &&
            oldByUid.get(uid)!.parentUid !== node.parentUid
          ) {
            movedUids.add(uid)
            // 标记其子树中所有节点
            for (const n of newNodes) {
              if (n.path.startsWith(`${node.path} > `)) {
                if (n.uid) movedUids.add(n.uid)
              }
            }
            // 也标记旧快照中对应子树
            const oldNode = oldByUid.get(uid)!
            for (const n of oldNodes) {
              if (n.path.startsWith(`${oldNode.path} > `)) {
                if (n.uid) movedUids.add(n.uid)
              }
            }
          }
        }
      } else if (change.type === 'COPY') {
        // 找到副本节点的 uid 及其所有子节点
        for (const n of newNodes) {
          if (n.uid && !oldByUid.has(n.uid)) {
            if (n.text === change.nodeText && n.type === change.nodeType) {
              copiedUids.add(n.uid)
              for (const child of newNodes) {
                if (child.path.startsWith(`${n.path} > `) && child.uid) {
                  copiedUids.add(child.uid)
                }
              }
            }
          }
        }
      }
    }

    // 过滤掉已被结构变更解释的节点
    const added = rawAdded.filter(n => !movedUids.has(n.uid) && !copiedUids.has(n.uid))
    const removed = rawRemoved.filter(n => !movedUids.has(n.uid))
    const modified: Array<{ node: FlatNode; changes: string[] }> = []

    // 查找内容修改的节点
    // 1. 常规路径匹配：path 不变的节点，检查内容是否有变化
    for (const [path, node] of newMap) {
      if (copiedUids.has(node.uid)) continue
      // 对于非 MOVE 节点，用 path 匹配
      if (!movedUids.has(node.uid)) {
        const old = oldMap.get(path)
        if (!old) continue
        const changes = this.detectContentChanges(old, node)
        if (changes.length > 0) {
          modified.push({ node, changes })
        }
      }
    }

    // 2. MOVE 节点的内容变更检测：path 变了，但 uid 相同，比较同 uid 的新旧内容
    for (const uid of movedUids) {
      const oldNode = oldByUid.get(uid)
      const newNode = newByUid.get(uid)
      if (!oldNode || !newNode) continue
      const changes = this.detectContentChanges(oldNode, newNode)
      if (changes.length > 0) {
        modified.push({ node: newNode, changes })
      }
    }

    const totalChanges = added.length + removed.length + modified.length + structuralChanges.length
    if (totalChanges === 0) return { text: null }

    const lines: string[] = []

    // 结构变更（MOVE / COPY）
    const structuralLines = this.formatStructuralChanges(structuralChanges)
    lines.push(...structuralLines)

    // 新增（+）—— 调用统一编译器
    for (const node of added) {
      const shortId = this.shortenByType(node)
      const parentShort = node.parentUid ? this.shortenParent(node.parentUid) : 'root'
      lines.push(ztdlAdd(node.type, shortId, node.text, parentShort, node.steps))
    }

    // 删除（-）
    for (const node of removed) {
      const shortId = this.shortenByType(node)
      lines.push(ztdlRemove(node.type, shortId, node.text))
    }

    // 修改（~）
    for (const { node, changes } of modified) {
      const shortId = this.shortenByType(node)
      const attrs = this.joinModifyAttrs(changes)
      lines.push(ztdlModify(node.type, shortId, attrs))
    }

    const diffText = lines.join('\n')
    const charCount = diffText.length

    // 估算 token 数量
    const estimatedTokens = this.estimateTokens(diffText)

    // 构建统计信息
    const stats: DiffStats = {
      addedCount: added.length,
      removedCount: removed.length,
      modifiedCount: modified.length,
      structuralChangesCount: structuralChanges.length,
      charCount,
      estimatedTokens
    }

    // 输出监控日志
    logger.info('[MindmapContextManager] Diff 统计:', {
      ...stats,
      totalChanges
    })

    // 超过阈值输出警告
    if (estimatedTokens > CONFIG.TOKEN_WARNING_THRESHOLD) {
      logger.warn(
        `[MindmapContextManager] Diff 预估 Token 数量 ${estimatedTokens} 超过警告阈值 ${CONFIG.TOKEN_WARNING_THRESHOLD}，可能影响性能和成本`
      )
    }

    if (totalChanges > CONFIG.DIFF_CHANGE_THRESHOLD) {
      logger.warn(
        `[MindmapContextManager] Diff 变更数量 ${totalChanges} 超过阈值 ${CONFIG.DIFF_CHANGE_THRESHOLD}，建议考虑优化`
      )
    }

    return { text: diffText, stats }
  }

  /** 粗略估算文本的 token 数 (委托给 ./context-manager/tokens) */
  private estimateTokens(text: string): number {
    return estimateTokens(text)
  }

  /**
   * 为消息准备上下文文本
   *
   * 返回值会被注入为 system message，AI 能清楚知道这是当前思维导图的实时状态
   */
  prepareContext(): { text: string; isFull: boolean; stats?: DiffStats } {
    const treeData = getMindMapSnapshot(this.mindMap)

    if (!treeData) {
      return { text: '当前思维导图为空，没有任何节点。', isFull: true }
    }

    const currentNodes = this.flattenTree(treeData)

    // 收集当前所有节点的 UUID，清理过期的 ID 映射
    const existingUuids = new Set(currentNodes.map(n => n.uid))
    const cleanedCount = this.idMapper.cleanupStaleMappings(existingUuids)
    if (cleanedCount > 0) {
      logger.info(`[MindmapContextManager] 清理了 ${cleanedCount} 个过期的 ID 映射`)
    }

    // 首次发送，提供全量
    if (!this.lastSnapshot) {
      // NOTE: 这里以前会 this.idMapper.reset(), 会把用户消息里 @-mention 提前
      // shorten 过的短 id 全部清掉, 导致用户消息里 M:n1「核心模块B」 与随后
      // 全量上下文里的 M:n1「核心模块A」 冲突. 保留已有映射, formatFullContext
      // 里的 shorten 会命中已存在则复用, 未见过再顺次分配, 不再错位.
      const fullText = this.formatFullContext(currentNodes)
      const estimatedTokens = this.estimateTokens(fullText)
      logger.info('[MindmapContextManager] 全量上下文统计:', {
        charCount: fullText.length,
        estimatedTokens,
        nodeCount: currentNodes.length
      })
      this.lastSnapshot = {
        version: this.currentVersion,
        nodes: currentNodes,
        timestamp: Date.now()
      }
      return {
        text: `[FULL]\n${fullText}`,
        isFull: true,
        stats: {
          addedCount: currentNodes.length,
          removedCount: 0,
          modifiedCount: 0,
          structuralChangesCount: 0,
          charCount: fullText.length,
          estimatedTokens
        }
      }
    }

    // 对比变更
    const diffResult = this.generateDiff(this.lastSnapshot.nodes, currentNodes)

    // 无变化
    if (diffResult.text === null) {
      return { text: '[NO_CHANGE]', isFull: false }
    }

    // 变化太多（diffText 为空字符串），使用全量
    if (diffResult.text === '') {
      this.idMapper.reset()
      const fullText = this.formatFullContext(currentNodes)
      this.lastSnapshot = {
        version: this.currentVersion,
        nodes: currentNodes,
        timestamp: Date.now()
      }
      return {
        text: `[FULL]\n${fullText}`,
        isFull: true
      }
    }

    // 使用增量变更
    this.lastSnapshot = {
      version: this.currentVersion,
      nodes: currentNodes,
      timestamp: Date.now()
    }
    return {
      text: `[DIFF]\n${diffResult.text}`,
      isFull: false,
      stats: diffResult.stats
    }
  }

  /**
   * 标记版本更新（每次发送消息后调用）
   */
  markSent(): void {
    this.currentVersion++
  }

  /**
   * 重置状态
   */
  reset(): void {
    this.lastSnapshot = null
    this.currentVersion = 0
    this.idMapper.reset()
  }

  /**
   * 获取当前快照（用于持久化到 IndexedDB）
   * 不含 path 字段以减少存储体积
   */
  getSnapshot(): SnapshotData | null {
    return this.lastSnapshot
  }

  /**
   * 剥离用例节点 text 中的 [P1]/[P2]/[P3] 优先级前缀
   * flattenTree 中 path 使用 rawText（不含前缀）拼接，restoreSnapshot 也必须保持一致
   */
  private stripPriorityPrefix(text: string): string {
    return text.replace(/^\[P\d\]/, '')
  }

  /**
   * 从持久化数据恢复快照（页面刷新 / 切换对话后）
   * path 字段会从 parentUid 链重建
   */
  restoreSnapshot(persisted: {
    version: number
    nodes: Array<Omit<FlatNode, 'path'>>
    timestamp: number
    idMapping?: MapperState
  }): void {
    // 重建 path：先建 uid -> node 索引，再从根节点开始递归拼接
    const uidMap = new Map<string, Omit<FlatNode, 'path'>>()
    for (const node of persisted.nodes) {
      if (node.uid) uidMap.set(node.uid, node)
    }

    const pathCache = new Map<string, string>()

    const buildPath = (node: Omit<FlatNode, 'path'>): string => {
      if (pathCache.has(node.uid)) return pathCache.get(node.uid)!
      // path 必须使用 rawText（不含 [P] 前缀），与 flattenTree 保持一致
      // flattenTree 中 currentPath 用 rawText 拼接，这里也剥离前缀再拼
      const rawText = this.stripPriorityPrefix(node.text)
      if (!node.parentUid) {
        pathCache.set(node.uid, rawText)
        return rawText
      }
      const parent = uidMap.get(node.parentUid)
      if (!parent) {
        pathCache.set(node.uid, rawText)
        return rawText
      }
      const parentPath = buildPath(parent)
      const path = `${parentPath} > ${rawText}`
      pathCache.set(node.uid, path)
      return path
    }

    const restoredNodes: FlatNode[] = persisted.nodes.map(node => ({
      ...node,
      path: buildPath(node)
    }))

    this.lastSnapshot = {
      version: persisted.version,
      nodes: restoredNodes,
      timestamp: persisted.timestamp
    }
    this.currentVersion = persisted.version + 1

    if (persisted.idMapping) {
      this.idMapper.restore(persisted.idMapping)
    }
  }

  private shortenByType(node: FlatNode): string {
    if (node.type === '模块') return this.idMapper.shorten(node.uid)
    if (node.type === '用例') return this.idMapper.shorten(node.uid)
    return node.uid
  }

  private shortenStructural(nodeType: string, uid: string): string {
    if (nodeType === '模块') return this.idMapper.shorten(uid)
    if (nodeType === '用例') return this.idMapper.shorten(uid)
    return uid
  }

  /** 缩短父节点 ID（父节点一般是模块） */
  private shortenParent(uid: string): string {
    return this.idMapper.shorten(uid)
  }

  /**
   * 获取状态（用于调试）
   */
  getStatus() {
    return {
      currentVersion: this.currentVersion,
      hasLastSnapshot: !!this.lastSnapshot,
      lastSnapshotVersion: this.lastSnapshot?.version,
      lastSnapshotTimestamp: this.lastSnapshot?.timestamp
    }
  }
}
