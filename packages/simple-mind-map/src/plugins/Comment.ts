// @ts-nocheck — vendored engine source
import { walk } from '../utils'

interface MindMapInstance {
  on(event: string, handler: Function, context?: unknown): void
  off(event: string, handler: Function): void
  emit(event: string, ...args: unknown[]): void
  renderer: Record<string, unknown> & {
    renderTree: Record<string, unknown> | null
    findNodeByUid(uid: string): Record<string, unknown> | null
  }
  opt: Record<string, unknown>
}

interface CommentInfo {
  count: number
  hasUnread: boolean
  latestComment: unknown
}

/**
 * 评论插件
 * 为思维导图节点添加评论数字标签
 * 完全参考协同插件的实现方式
 */
export default class Comment {
  static instanceName: string = 'comment'
  static pluginName: string = 'comment'

  private mindMap: MindMapInstance
  private commentCounts: Map<string, CommentInfo>
  private options: {
    onNodeCommentClick: ((nodeUid: string) => void) | null
  }

  constructor(opt: Record<string, unknown> = {}) {
    this.mindMap = opt.mindMap as MindMapInstance
    this.commentCounts = new Map()

    this.options = {
      onNodeCommentClick: null,
      ...opt
    } as { onNodeCommentClick: ((nodeUid: string) => void) | null }

    this.bindEvent()
  }

  /**
   * 绑定事件
   */
  bindEvent(): void {
    this.mindMap.on('node_remove', this.onNodeRemove, this)
  }

  /**
   * 解绑事件
   */
  unbindEvent(): void {
    this.mindMap.off('node_remove', this.onNodeRemove)
  }

  /**
   * 销毁插件
   */
  destroy(): void {
    this.unbindEvent()
    this.commentCounts.clear()
  }

  /**
   * 节点删除时的处理
   */
  onNodeRemove(node: Record<string, unknown>): void {
    if (
      node.nodeData &&
      (node.nodeData as Record<string, unknown>).data &&
      ((node.nodeData as Record<string, unknown>).data as Record<string, unknown>).uid
    ) {
      this.commentCounts.delete(
        ((node.nodeData as Record<string, unknown>).data as Record<string, unknown>).uid as string
      )
    }
  }

  /**
   * 设置节点评论信息
   */
  setNodeCommentInfo(
    nodeUid: string,
    count: number = 0,
    hasUnread: boolean = false,
    latestComment: unknown = null
  ): void {
    if (count > 0) {
      this.commentCounts.set(nodeUid, {
        count,
        hasUnread,
        latestComment
      })
    } else {
      this.commentCounts.delete(nodeUid)
    }
  }

  /**
   * 获取节点评论信息
   */
  getNodeCommentInfo(nodeUid: string): CommentInfo | null {
    return this.commentCounts.get(nodeUid) || null
  }

  /**
   * 根据UID查找节点实例
   */
  findNodeByUid(uid: string): Record<string, unknown> | null {
    if (!this.mindMap.renderer) return null
    return this.mindMap.renderer.findNodeByUid(uid)
  }

  /**
   * 批量设置评论信息
   */
  setCommentStats(commentStats: Record<string, CommentInfo>): void {
    const oldEntries = Array.from(this.commentCounts.entries())
    const newEntries = Object.entries(commentStats).filter(([, info]) => info.count > 0)

    const hasChanged =
      oldEntries.length !== newEntries.length ||
      oldEntries.some(([nodeUid, oldInfo]) => {
        const newInfo = commentStats[nodeUid]
        return !newInfo || oldInfo.count !== newInfo.count
      })

    if (!hasChanged) {
      return
    }

    const oldNodeUids = new Set(this.commentCounts.keys())

    this.commentCounts.clear()

    Object.entries(commentStats).forEach(([nodeUid, info]) => {
      if (info.count > 0) {
        this.commentCounts.set(nodeUid, info)
      }
    })

    this.updateAffectedNodes(commentStats, oldNodeUids)
  }

  /**
   * 更新受影响的节点
   */
  updateAffectedNodes(
    commentStats: Record<string, CommentInfo>,
    oldNodeUids: Set<string> = new Set()
  ): void {
    if (!this.mindMap.renderer || !this.mindMap.renderer.renderTree) {
      return
    }

    const affectedNodeUids = new Set<string>()

    Object.keys(commentStats).forEach(nodeUid => {
      if (commentStats[nodeUid].count > 0) {
        affectedNodeUids.add(nodeUid)
      }
    })

    oldNodeUids.forEach(nodeUid => {
      affectedNodeUids.add(nodeUid)
    })

    affectedNodeUids.forEach(nodeUid => {
      const node = this.findNodeByUid(nodeUid)
      if (node && (node as Record<string, unknown>).reRender) {
        ;(node as Record<string, unknown> & { reRender(fields: string[]): void }).reRender([
          'commentLabel'
        ])
      }
    })
  }
}