/**
 * DocumentSync - 思维导图协作同步模块（节点级 CRDT）
 *
 * 核心原则：
 *   1. Y.Doc layout 见 ./node-tree.js：meta / nodes / children
 *   2. 本地 data_change → diff 出实际变化字段/子节点顺序 → 精准写入 Y.Doc
 *   3. 远端 Y.Doc 变化 → observeDeep → 重建完整树 → mindMap.updateData
 *   4. transaction.origin === this 防 echo loop（取代 isSameObject 的全树比对）
 *   5. 同步未就绪前不响应本地变更，防止初始化冲洗远端
 */
import * as Y from 'yjs'
import type { MindMapNodeTree } from '../../index'
interface MindMapInstance {
  on(event: string, handler: Function): void
  off(event: string, handler: Function): void
  updateData(data: MindMapNodeTree): void
  emit?: (event: string, ...args: unknown[]) => void
  opt: Record<string, unknown>
}
declare class DocumentSync {
  mindMap: MindMapInstance
  ydoc: Y.Doc
  isApplyingRemote: boolean
  lastSyncedTree: MindMapNodeTree | null
  isSyncReady: boolean
  constructor({ mindMap }: { mindMap: MindMapInstance })
  bootstrapFromInitialState(): void
  bind(): void
  unbind(): void
  destroy(): void
  getDoc(): Y.Doc
  /**
   * 标记同步已完成，允许响应本地变更
   */
  setSyncReady(): void
  /**
   * 远端事务处理：origin === this 是本地写入 echo，跳过
   */
  handleDeepChange(transaction: Y.Transaction): void
  /**
   * 本地数据变化 → 节点级 patch 写入 Y.Doc
   */
  onDataChange(data: MindMapNodeTree): void
  /**
   * setData 事件（用户导入等操作）
   */
  onSetData(data: MindMapNodeTree): void
  /**
   * 主题变化
   */
  onThemeChange(theme: string): void
}
export { DocumentSync }
