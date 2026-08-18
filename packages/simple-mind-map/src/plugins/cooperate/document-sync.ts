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
import { applyTreePatch, isDocInitialized, readTreeFromDoc, writeTreeToDoc } from './node-tree'
import type { MindMapNodeTree } from '../../index'

interface MindMapInstance {
  on(event: string, handler: Function): void
  off(event: string, handler: Function): void
  updateData(data: MindMapNodeTree): void
  emit?: (event: string, ...args: unknown[]) => void
  opt: Record<string, unknown>
}

class DocumentSync {
  declare mindMap: MindMapInstance
  declare ydoc: Y.Doc
  declare isApplyingRemote: boolean
  declare lastSyncedTree: MindMapNodeTree | null
  declare isSyncReady: boolean

  constructor({ mindMap }: { mindMap: MindMapInstance }) {
    this.mindMap = mindMap
    this.ydoc = new Y.Doc()

    // 状态标志
    this.isApplyingRemote = false
    this.isSyncReady = false
    this.lastSyncedTree = null

    // 绑定方法
    this.bootstrapFromInitialState = this.bootstrapFromInitialState.bind(this)
    this.handleDeepChange = this.handleDeepChange.bind(this)
    this.onDataChange = this.onDataChange.bind(this)
    this.onSetData = this.onSetData.bind(this)
    this.onThemeChange = this.onThemeChange.bind(this)

    // 在建立连接前先注入初始 Yjs 状态，减少首次全量同步开销
    this.bootstrapFromInitialState()

    // 监听 Y.Doc 整体深层变化（meta + nodes + children 任意子结构）
    this.ydoc.on('afterTransaction', this.handleDeepChange)
  }

  bootstrapFromInitialState() {
    const initialState =
      this.mindMap &&
      this.mindMap.opt &&
      (this.mindMap.opt.cooperateInitialDocState as Uint8Array | undefined)
    if (!initialState || !(initialState instanceof Uint8Array) || initialState.length === 0) {
      return
    }

    try {
      Y.applyUpdateV2(this.ydoc, initialState)

      if (isDocInitialized(this.ydoc)) {
        const tree = readTreeFromDoc(this.ydoc)
        if (tree) {
          this.lastSyncedTree = tree as MindMapNodeTree
          this.isApplyingRemote = true
          try {
            this.mindMap.updateData(tree as MindMapNodeTree)
          } finally {
            this.isApplyingRemote = false
          }
        }
      }
    } catch (error) {
      console.error('协作同步: 注入初始Yjs状态失败', error)
    }
  }
  bind() {
    this.mindMap.on('data_change', this.onDataChange)
    this.mindMap.on('set_data', this.onSetData)
    this.mindMap.on('view_theme_change', this.onThemeChange)
  }

  unbind() {
    this.mindMap.off('data_change', this.onDataChange)
    this.mindMap.off('set_data', this.onSetData)
    this.mindMap.off('view_theme_change', this.onThemeChange)
  }

  destroy() {
    this.unbind()
    this.ydoc.off('afterTransaction', this.handleDeepChange)
    this.ydoc.destroy()
  }

  getDoc() {
    return this.ydoc
  }

  /**
   * 标记同步已完成，允许响应本地变更
   */
  setSyncReady() {
    this.isSyncReady = true
    // 同步就绪后，确保 lastSyncedTree 反映当前 Y.Doc 状态
    if (!this.lastSyncedTree && isDocInitialized(this.ydoc)) {
      this.lastSyncedTree = readTreeFromDoc(this.ydoc) as unknown as MindMapNodeTree
    }
    console.info('协作同步: 同步就绪，开始响应本地变更')
  }

  /**
   * 远端事务处理：origin === this 是本地写入 echo，跳过
   */
  handleDeepChange(transaction: Y.Transaction) {
    if (transaction.origin === this) return
    if (!transaction.changed || transaction.changed.size === 0) return

    // 任意 meta/nodes/children 变更 → 重建树
    const tree = readTreeFromDoc(this.ydoc)
    if (!tree) return

    this.lastSyncedTree = tree as unknown as MindMapNodeTree
    this.isApplyingRemote = true
    try {
      this.mindMap.updateData(tree as unknown as MindMapNodeTree)
      if (this.mindMap.emit) {
        this.mindMap.emit('collaborationDataReady')
      }
    } catch (error) {
      console.error('协作同步: 应用远程数据失败', error)
    } finally {
      this.isApplyingRemote = false
    }
  }

  /**
   * 本地数据变化 → 节点级 patch 写入 Y.Doc
   */
  onDataChange(data: MindMapNodeTree) {
    if (this.isApplyingRemote) return
    if (!data) return

    try {
      if (!isDocInitialized(this.ydoc)) {
        // 房间从未初始化（罕见路径），全量写入
        writeTreeToDoc(this.ydoc, data, this)
      } else {
        applyTreePatch(this.ydoc, data, this.lastSyncedTree, this)
      }
      this.lastSyncedTree = data
    } catch (error) {
      console.error('协作同步: 写入本地变更失败，尝试全量重置', error)
      // 兜底：清空 nodes/children/meta 并全量写入新树，避免长期 lastSyncedTree 漂移
      try {
        this.ydoc.transact(() => {
          const nodes = this.ydoc.getMap('nodes')
          const children = this.ydoc.getMap('children')
          Array.from(nodes.keys()).forEach(k => nodes.delete(k))
          Array.from(children.keys()).forEach(k => children.delete(k))
        }, this)
        writeTreeToDoc(this.ydoc, data, this)
        this.lastSyncedTree = data
      } catch (fallbackError) {
        console.error('协作同步: 全量重置也失败', fallbackError)
      }
    }
  }

  /**
   * setData 事件（用户导入等操作）
   */
  onSetData(data: MindMapNodeTree) {
    this.onDataChange(data)
  }

  /**
   * 主题变化
   */
  onThemeChange(theme: string) {
    if (!this.isSyncReady) return
    this.ydoc.transact(() => {
      this.ydoc.getMap('meta').set('theme', theme)
    }, this)
  }
}

export { DocumentSync }
