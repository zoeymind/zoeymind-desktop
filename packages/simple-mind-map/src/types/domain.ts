/**
 * simple-mind-map 域类型
 *
 * 所有类型定义在同一个文件中，作为 tsc 输出的单一事实源。
 * 这些类型通过 `src/index.ts` 的 `export type { ... }` 暴露给消费者。
 */

// ============================================
// 节点数据（序列化格式）
// ============================================

/**
 * 单个节点的序列化数据
 */
export interface MindMapNodeData {
  text: string
  uid?: string
  expand?: boolean
  isActive?: boolean
  richText?: boolean | string
  resetRichText?: boolean
  icon?: string[]
  image?: string
  imageTitle?: string
  imageSize?: { width: number; height: number }
  tag?: string[]
  hyperlink?: string
  hyperlinkTitle?: string
  note?: string
  generalization?: {
    text: string
    expand?: boolean
    isActive?: boolean
    [key: string]: unknown
  }
  // 允许扩展字段（消费者可以添加自定义数据）
  [key: string]: unknown
}

/**
 * 节点树（序列化格式，递归结构）
 */
export interface MindMapNodeTree {
  data: MindMapNodeData
  children: MindMapNodeTree[]
}

// 向后兼容别名
export type NodeData = MindMapNodeTree

// ============================================
// 运行时节点实例
// ============================================

/**
 * 运行时节点实例（不是序列化数据，是渲染/操作对象）
 */
export interface MindMapNode {
  uid: string | undefined
  nodeData: {
    data: MindMapNodeData & Record<string, unknown>
    children?: unknown[]
    [key: string]: unknown
  }
  data: MindMapNodeData & Record<string, unknown>
  parent: MindMapNode | null
  children: MindMapNode[]
  isRoot: boolean
  layerIndex: number
  width: number
  height: number
  left: number
  top: number

  // Methods
  getData(): MindMapNodeData
  getData<K extends keyof MindMapNodeData>(key: K): MindMapNodeData[K]
  getPureData(removeActiveState?: boolean, removeId?: boolean): MindMapNodeTree
  setIcon(icons: string[]): void
  getRect(): { x: number; y: number; width: number; height: number }
  active(e?: Event): void
  deactivate(): void
  update(forceRender?: boolean): void
  remove(): void
  destroy(): void
  hide(): void
  show(): void
}

// ============================================
// 水印插件
// ============================================

export interface WatermarkPlugin {
  hasWatermark(): boolean
  isInExport: boolean
  onResize(): void
  clear(): void
  [key: string]: unknown
}
// ============================================
// 配置选项
// ============================================

/**
 * MindMap 构造函数配置选项
 */
export interface MindMapOptions {
  el: HTMLElement
  data?: MindMapNodeTree | Record<string, unknown> | null
  readonly?: boolean
  layout?: string
  theme?: string
  themeConfig?: Record<string, unknown>
  // 允许扩展配置
  [key: string]: unknown
}

// ============================================
// 协作插件
// ============================================

export interface CooperatePlugin {
  getDoc(): object
  setSyncReady(): void
  setProvider(provider: unknown): void
  setUserInfo(userInfo: unknown): void
  beforePluginRemove(): void
  beforePluginDestroy(): void
  awarenessSync?: {
    setCursor?: (cursor: { x: number; y: number } | null) => void
    setProjectTitle?: (title: string) => void
    userInfo?: Record<string, string>
  }
}
// ============================================

export interface DrawInterface {
  matrixify(): { a: number; b: number; c: number; d: number; e: number; f: number }
  point(x: number, y: number): { x: number; y: number }
  [key: string]: unknown
}

// ============================================
// CRDT / Yjs 协作节点树
// ============================================

export interface NodeTree {
  data: Record<string, unknown>
  children?: NodeTree[]
}

// ============================================
// 可选插件实例映射
// ============================================

/**
 * MindMap 上可选的插件实例。
 * 这些属性在 MindMap 类上声明为 `? `（可选），
 * 当插件注册后可用。
 */
export interface PluginInstanceMap {
  cooperate?: CooperatePlugin
  comment?: {
    commentCounts: Map<string, { count: number; hasUnread?: boolean }>
    setCommentStats(stats: Record<string, { count: number; hasUnread?: boolean }>): void
    getNodeCommentInfo(nodeUid: string): { count: number } | null
    options: { onNodeCommentClick?: (nodeUid: string) => void }
  }
  search?: {
    search(text: string, callback?: () => void): void
    endSearch(): void
    jump(index: number): void
    replace(text: string): void
    replaceAll(text: string): void
  }
  scrollbar?: {
    setScrollBarWrapSize(width: number, height: number): void
    calculationScrollbar(): {
      vertical: { top: number; height: number }
      horizontal: { left: number; width: number }
    }
    onMousedown(e: MouseEvent, type: 'vertical' | 'horizontal'): void
    onClick(e: MouseEvent, type: 'vertical' | 'horizontal'): void
  }
  doExport?: {
    export(...args: unknown[]): Promise<string | Blob>
    png(fileName: string, transparent?: boolean): Promise<string>
    svg(fileName: string): Promise<string>
    pdf(fileName: string, transparent?: boolean): Promise<Blob>
    md(): Promise<string>
    json(fileName: string, withConfig?: boolean): Promise<string>
    txt(): Promise<string>
    [key: string]: unknown
  }
  ghostCompletion?: {
    show(text: string, node?: MindMapNode): void
    hide(): void
  }
}
