/**
 * MindMap 扩展类型定义
 *
 * 用于扩展 simple-mind-map 库的类型，支持运行时属性和插件类型
 */

import type {
  default as MindMap,
  CooperatePlugin as MindMapCooperate,
  MindMapNode,
  MindMapNodeTree
} from 'simple-mind-map'
import type * as Y from 'yjs'

// ============================================
// 协作插件类型
// ============================================

/**
 * 用户信息
 */
export interface CollaborationUserInfo {
  id: string
  name?: string
  avatar?: string
  color?: string
  canEdit?: boolean
}

/**
 * 光标位置
 */
export interface CursorPosition {
  x: number
  y: number
}

/**
 * Awareness 同步插件
 */
export interface AwarenessSync {
  setCursor?: (cursor: CursorPosition | null) => void
  setProjectTitle?: (title: string) => void
  userInfo?: CollaborationUserInfo
}

/**
 * 协作插件类型
 */
export interface CooperatePlugin {
  getDoc(): Y.Doc
  setUserInfo(info: { id: string; name?: string; avatar?: string; color?: string }): void
  setProvider(provider: unknown): void
  setSyncReady(): void
  beforePluginRemove(): void
  beforePluginDestroy(): void
  awarenessSync?: {
    setCursor?: (cursor: { x: number; y: number } | null) => void
    setProjectTitle?: (title: string) => void
    userInfo?: { id?: string }
  }
}

// ============================================
// 快照相关类型
// ============================================

/**
 * 快照数据
 */
export interface SnapshotData {
  id?: string
  name?: string
  description?: string
  data: MindMapNodeTree
  timestamp?: number
  createdAt?: string | Date
  updatedAt?: string | Date
}

/**
 * 云端快照
 */
export interface CloudSnapshot {
  id: string
  name: string
  description?: string
  snapshotData: MindMapNodeTree
  snapshotHash: string
  nodeCount: number
  createdAt: string | Date
  updatedAt: string | Date
}

// ============================================
// 节点数据扩展类型
// ============================================

/**
 * 扩展节点数据（包含优先级和测试用例信息）
 */
export interface ExtendedNodeData {
  uid?: string
  text?: string
  icon?: string[]
  hyperlink?: string
  hyperlinkTitle?: string
  note?: string
  tag?: string[]
  image?: string
  imageTitle?: string
  imageSize?: { width: number; height: number }
  /** 扩展字段 */
  richText?: boolean
  expand?: boolean
  isActive?: boolean
  generalization?: unknown
}

/**
 * 测试用例节点
 */
export interface TestCaseNode extends ExtendedNodeData {
  priority?: 1 | 2 | 3
  steps?: string[]
}

// ============================================
// 格式转换相关类型
// ============================================

/**
 * 飞书思维导图节点
 */
export interface FSNode {
  id: string
  topic: string
  children?: FSNode[]
  style?: Record<string, unknown>
}

/**
 * XMind 节点数据
 */
export interface XMindNode {
  id?: string
  title?: string
  children?: { attached?: XMindNode[] }
  notes?: { plain?: { content?: string } }
  href?: string
  labels?: string[]
  markers?: Array<{ markerId?: string }>
}

/**
 * FreeMind 节点数据
 */
export interface FreeMindNode {
  node?: FreeMindNode | FreeMindNode[]
  '@_TEXT'?: string
  '@_ID'?: string
  '@_LINK'?: string
  icon?: Array<{ '@_BUILTIN'?: string }> | { '@_BUILTIN'?: string }
}

// ============================================
// 类型守卫函数
// ============================================

/**
 * 检查 MindMap 实例是否有协作插件
 */
export function hasCooperatePlugin(mindMap: MindMap): mindMap is MindMap & {
  cooperate: NonNullable<MindMap['cooperate']>
} {
  return 'cooperate' in mindMap && mindMap.cooperate !== undefined
}

/**
 * 安全地访问 MindMap 的 cooperate 插件
 */
export function getCooperatePlugin(mindMap: MindMap): MindMapCooperate | undefined {
  if (hasCooperatePlugin(mindMap)) {
    return mindMap.cooperate
  }
  return undefined
}

/**
 * 安全地设置 __waitingForCollaboration 标记
 */
export function setWaitingForCollaboration(mindMap: MindMap, waiting: boolean): void {
  if (waiting) {
    mindMap.__waitingForCollaboration = true
  } else {
    delete mindMap.__waitingForCollaboration
  }
}

/**
 * 检查是否正在等待协作同步
 */
export function isWaitingForCollaboration(mindMap: MindMap): boolean {
  return mindMap.__waitingForCollaboration === true
}

// 重新导出原始类型以便统一导入
export type { MindMap, MindMapNode, MindMapNodeTree }
