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
  static instanceName: string
  static pluginName: string
  private mindMap
  private commentCounts
  private options
  constructor(opt?: Record<string, unknown>)
  /**
   * 绑定事件
   */
  bindEvent(): void
  /**
   * 解绑事件
   */
  unbindEvent(): void
  /**
   * 销毁插件
   */
  destroy(): void
  /**
   * 节点删除时的处理
   */
  onNodeRemove(node: Record<string, unknown>): void
  /**
   * 设置节点评论信息
   */
  setNodeCommentInfo(
    nodeUid: string,
    count?: number,
    hasUnread?: boolean,
    latestComment?: unknown
  ): void
  /**
   * 获取节点评论信息
   */
  getNodeCommentInfo(nodeUid: string): CommentInfo | null
  /**
   * 根据UID查找节点实例
   */
  findNodeByUid(uid: string): Record<string, unknown> | null
  /**
   * 批量设置评论信息
   */
  setCommentStats(commentStats: Record<string, CommentInfo>): void
  /**
   * 更新受影响的节点
   */
  updateAffectedNodes(commentStats: Record<string, CommentInfo>, oldNodeUids?: Set<string>): void
}
export {}
