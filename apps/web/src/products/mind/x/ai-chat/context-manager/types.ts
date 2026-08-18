// @ts-nocheck — dormant AI chat / MCP module (bridge.tsx flattens to no-op)
/**
 * MindmapContextManager 的内部类型. 从 MindmapContextManager.ts 抽出来,
 * 方便分散到 flatten/diff/render 等子模块复用.
 */

/** 扁平化后的节点信息 */
export interface FlatNode {
  /** 节点唯一标识 */
  uid: string
  /** 父节点唯一标识 (根节点为空) */
  parentUid: string | null
  /** 节点路径标识 (如 "根 > 模块A > 用例1") */
  path: string
  /** 节点文本 */
  text: string
  /** 节点类型 */
  type: '根节点' | '模块' | '用例' | '步骤' | '普通节点'
  /** 节点深度 */
  depth: number
  /** 用例的步骤列表 (仅用例节点有值) */
  steps?: string[]
  /** 子节点数量 (用于 COPY 检测时比较子树规模) */
  childCount: number
}

/** 结构变更操作类型 */
export type StructuralChangeType = 'MOVE' | 'COPY'

/** 结构变更记录 */
export interface StructuralChange {
  type: StructuralChangeType
  /** 涉及的节点 UID */
  nodeUid: string
  /** 涉及的节点文本 */
  nodeText: string
  /** 涉及的节点类型 */
  nodeType: FlatNode['type']
  /** MOVE: 原父节点 UID / COPY: 无 */
  fromUid: string | null
  /** MOVE: 原父节点文本 / COPY: 源节点文本 */
  fromText: string
  /** MOVE: 新父节点 UID / COPY: 目标父节点 UID */
  toUid: string | null
  /** MOVE: 新父节点文本 / COPY: 目标父节点文本 */
  toText: string
  /** COPY 专用: 副本下的用例数量 */
  copiedCaseCount?: number
  /** COPY 专用: 副本下的总节点数量 */
  copiedNodeCount?: number
}

/** 完整 / 增量快照 */
export interface SnapshotData {
  version: number
  /** 扁平化的节点列表 */
  nodes: FlatNode[]
  timestamp: number
}

/** diff 统计信息 */
export interface DiffStats {
  /** 新增节点数 */
  addedCount: number
  /** 删除节点数 */
  removedCount: number
  /** 修改节点数 */
  modifiedCount: number
  /** 结构变更数 */
  structuralChangesCount: number
  /** diff 文本字符数 */
  charCount: number
  /** 估算的 token 数 (粗略估算: 中文字符 = 1.5 tokens, 英文字符 = 0.25 tokens) */
  estimatedTokens: number
}