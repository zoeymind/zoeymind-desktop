/**
 * CommentService - 评论协同服务（纯 class，不依赖 React）
 *
 * 职责：
 * 1. 管理评论 Y.Doc 和 HocuspocusProvider 生命周期
 * 2. 提供评论 CRUD 操作
 * 3. 通过 onChange/onError 回调通知上层
 * 4. HTTP 预加载评论初始状态
 *
 * 设计原则：
 * - 与 React 渲染周期完全解耦
 * - 方法引用天然稳定（class 方法不会因 re-render 变化）
 * - 便于测试：直接 new CommentService() 即可
 */

import { logger } from '@zoeymind/logger'
import * as Y from 'yjs'
import { HocuspocusProvider, type onCloseParameters } from '@hocuspocus/provider'
import { getBrowserInstanceId } from '@/products/mind/utils/browser-instance'
import { trpcClient, buildWsUrl } from '@/shared/app-shared'
import type { CommentData, CommentStats, YJSCommentData } from '@zoeymind/shared'

// ── 类型定义 ──────────────────────────────────────────

export interface CommentUserInfo {
  id: string
  name: string
  avatar?: string
  userId: string
}

export interface CommentSnapshot {
  comments: { [nodeUid: string]: CommentData[] }
  stats: CommentStats
  total: number
}

export type CommentErrorType = 'auth' | 'forbidden' | 'not_found' | 'server' | 'params'

type ChangeCallback = (snapshot: CommentSnapshot) => void
type ErrorCallback = (type: CommentErrorType, message: string) => void

export const EMPTY_SNAPSHOT: CommentSnapshot = { comments: {}, stats: {}, total: 0 }

// ── 工具函数 ──────────────────────────────────────────

function generateCommentId(): string {
  return `comment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

function yMapToComment(yMap: Y.Map<unknown>): CommentData {
  const userName = yMap.get('userName') || '匿名用户'
  const userAvatar = yMap.get('userAvatar') || null

  return {
    id: String(yMap.get('id') || ''),
    mindmapId: String(yMap.get('mindmapId') || ''),
    nodeUid: String(yMap.get('nodeUid') || ''),
    userId: String(yMap.get('userId') || ''),
    userName: String(userName),
    content: String(yMap.get('content') || ''),
    createdAt: String(yMap.get('createdAt') || new Date().toISOString()),
    updatedAt: String(yMap.get('updatedAt') || new Date().toISOString()),
    deletedAt: undefined,
    user: {
      id: String(yMap.get('userId') || ''),
      name: String(userName),
      avatar: userAvatar ? String(userAvatar) : undefined
    }
  }
}

// ── CommentService ───────────────────────────────────

export class CommentService {
  private doc: Y.Doc | null = null
  private provider: HocuspocusProvider | null = null
  private commentMap: Y.Map<Y.Map<unknown>> | null = null
  private workspaceId: string | null = null
  private userInfo: CommentUserInfo | null = null

  private changeCallbacks = new Set<ChangeCallback>()
  private errorCallbacks = new Set<ErrorCallback>()
  private observer: (() => void) | null = null
  private hasShownErrorToast = false

  // ── 连接管理 ─────────────────────────────────

  /**
   * 连接到评论协同服务
   * 流程：创建 Y.Doc → HTTP 预加载 → 创建 WebSocket provider → 注册 observer
   */
  async connect(
    workspaceId: string,
    token: string | null,
    userInfo: CommentUserInfo
  ): Promise<void> {
    // 如果已连接到同一项目，跳过
    if (this.workspaceId === workspaceId && this.provider) {
      return
    }

    // 先断开旧连接
    this.disconnect()

    this.workspaceId = workspaceId
    this.userInfo = userInfo

    // 1. 创建 Y.Doc
    this.doc = new Y.Doc()
    this.commentMap = this.doc.getMap('comments')

    // 2. HTTP 预加载评论数据
    await this.loadInitialState(workspaceId)

    // 3. 创建 WebSocket provider
    this.createProvider(workspaceId, token, userInfo)

    // 4. 注册数据变化 observer
    this.registerObserver()

    // 5. 立即通知一次当前快照（包含 HTTP 预加载的数据）
    this.notifyChange()

    logger.info('评论服务已连接', { workspaceId })
  }

  /**
   * 断开连接，清理所有资源
   */
  disconnect(): void {
    if (this.observer && this.commentMap) {
      this.commentMap.unobserveDeep(this.observer)
      this.observer = null
    }

    if (this.provider) {
      try {
        this.provider.destroy()
      } catch {
        /* ignore */
      }
      this.provider = null
    }

    if (this.doc) {
      this.doc.destroy()
      this.doc = null
    }

    this.commentMap = null
    this.workspaceId = null
    this.userInfo = null
    this.hasShownErrorToast = false
  }

  isConnected(): boolean {
    return this.provider !== null
  }

  // ── CRUD 操作 ────────────────────────────────

  addComment(nodeUid: string, content: string): CommentData {
    const map = this.ensureCommentMap()
    const userInfo = this.ensureUserInfo()

    const commentId = generateCommentId()
    const now = new Date().toISOString()

    const data: YJSCommentData = {
      id: commentId,
      mindmapId: this.workspaceId || '',
      nodeUid,
      userId: userInfo.userId,
      userName: userInfo.name,
      userAvatar: userInfo.avatar,
      content,
      createdAt: now,
      updatedAt: now
    }

    const yMap = new Y.Map()
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) yMap.set(key, value)
    }
    map.set(commentId, yMap)

    logger.info('评论已添加', { commentId, nodeUid })
    return yMapToComment(yMap)
  }

  updateComment(commentId: string, content: string): CommentData {
    const map = this.ensureCommentMap()
    const userInfo = this.ensureUserInfo()

    const yMap = map.get(commentId)
    if (!yMap) throw new Error('评论不存在')
    if (yMap.get('userId') !== userInfo.userId) throw new Error('无权限编辑此评论')

    yMap.set('content', content)
    yMap.set('updatedAt', new Date().toISOString())

    logger.info('评论已更新', { commentId })
    return yMapToComment(yMap)
  }

  deleteComment(commentId: string): void {
    const map = this.ensureCommentMap()
    const userInfo = this.ensureUserInfo()

    const yMap = map.get(commentId)
    if (!yMap) throw new Error('评论不存在')
    if (yMap.get('userId') !== userInfo.userId) throw new Error('无权限删除此评论')

    map.delete(commentId)
    logger.info('评论已删除', { commentId })
  }

  // ── 数据读取 ─────────────────────────────────

  /**
   * 获取当前评论数据快照
   */
  getSnapshot(): CommentSnapshot {
    if (!this.commentMap) return EMPTY_SNAPSHOT

    const comments: { [nodeUid: string]: CommentData[] } = {}
    const stats: CommentStats = {}
    let total = 0

    this.commentMap.forEach((yMap: Y.Map<unknown>) => {
      const comment = yMapToComment(yMap)
      const { nodeUid } = comment

      if (!comments[nodeUid]) comments[nodeUid] = []
      comments[nodeUid].push(comment)
      total++

      if (!stats[nodeUid]) {
        stats[nodeUid] = {
          count: 0,
          latestComment: {
            content: comment.content,
            userName: comment.user?.name || '匿名用户',
            createdAt: comment.createdAt
          }
        }
      }
      stats[nodeUid].count++

      const existing = stats[nodeUid].latestComment
      if (existing && new Date(comment.createdAt) > new Date(existing.createdAt)) {
        stats[nodeUid].latestComment = {
          content: comment.content,
          userName: comment.user?.name || '匿名用户',
          createdAt: comment.createdAt
        }
      }
    })

    // 按时间排序（最新的在下面）
    for (const nodeUid of Object.keys(comments)) {
      comments[nodeUid].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      )
    }

    return { comments, stats, total }
  }

  // ── 回调注册 ─────────────────────────────────

  /**
   * 注册数据变化回调（Y.Map 变化时触发）
   * @returns 取消注册函数
   */
  onChange(cb: ChangeCallback): () => void {
    this.changeCallbacks.add(cb)
    return () => {
      this.changeCallbacks.delete(cb)
    }
  }

  /**
   * 注册错误回调（WebSocket 错误时触发）
   * @returns 取消注册函数
   */
  onError(cb: ErrorCallback): () => void {
    this.errorCallbacks.add(cb)
    return () => {
      this.errorCallbacks.delete(cb)
    }
  }

  // ── 私有方法 ─────────────────────────────────

  private async loadInitialState(workspaceId: string): Promise<void> {
    if (!this.doc) return

    try {
      logger.info('开始从HTTP获取评论Y.Doc状态', { workspaceId })
      const response = await trpcClient.mindmap.comment.getYDocState.query({
        mindmapId: workspaceId
      })

      if (!response.success || !response.hasState || !response.state) {
        logger.info('未从API获取到评论Y.Doc状态，保持空文档', { workspaceId })
        return
      }

      const binaryString = atob(response.state)
      const buffer = new Uint8Array(binaryString.length)
      for (let i = 0; i < binaryString.length; i++) {
        buffer[i] = binaryString.charCodeAt(i)
      }

      Y.applyUpdateV2(this.doc, buffer)
      logger.info('从API恢复评论Y.Doc状态成功', {
        workspaceId,
        size: `${(buffer.length / 1024).toFixed(2)}KB`,
        commentCount: this.doc.getMap('comments').size
      })
    } catch (error) {
      logger.error('从API恢复评论Y.Doc状态失败', { workspaceId, error })
      // 失败也继续，让 WebSocket 同步数据
    }
  }

  private createProvider(
    workspaceId: string,
    token: string | null,
    userInfo: CommentUserInfo
  ): void {
    if (!this.doc) return

    const roomName = `comments_${workspaceId}`

    this.provider = new HocuspocusProvider({
      url: buildWsUrl(),
      name: roomName,
      document: this.doc,
      token: token || undefined,
      onStatus: (event: { status: string }) => {
        logger.debug('评论WebSocket状态变化', { roomName, status: event.status })
      },
      onClose: (data: onCloseParameters) => this.handleConnectionClose(data),
      onDisconnect: (data: onCloseParameters) => this.handleConnectionClose(data),
      onAuthenticationFailed: () => {
        this.notifyError('auth', '评论协作授权失败，请重新登录')
      }
    })

    // 设置用户 awareness
    if (this.provider.awareness) {
      this.provider.awareness.setLocalStateField('user', {
        id: userInfo.id || `anonymous_${getBrowserInstanceId()}`,
        name: userInfo.name || '匿名用户',
        avatar: userInfo.avatar,
        userId: userInfo.userId || 'anonymous'
      })
    }

    logger.info('评论系统WebSocket连接已建立', { roomName, workspaceId })
  }

  private handleConnectionClose(data: onCloseParameters): void {
    const { code, reason } = data.event
    logger.info('评论WebSocket连接已断开', { code, reason })

    if (this.hasShownErrorToast || !code) return

    const errorMap: Record<number, [CommentErrorType, string]> = {
      4401: ['auth', '评论协作授权失败，请重新登录'],
      4403: ['forbidden', '评论协作权限不足，无法访问此项目'],
      4404: ['not_found', '评论协作失败：项目不存在或已被删除'],
      1011: ['server', '评论协作服务器错误，请稍后重试'],
      1002: ['params', '评论协作参数错误，请刷新页面重试']
    }

    const entry = errorMap[code]
    if (entry) {
      this.hasShownErrorToast = true
      this.notifyError(entry[0], entry[1])
    }
  }

  private registerObserver(): void {
    if (!this.commentMap) return

    this.observer = () => {
      this.notifyChange()
    }
    this.commentMap.observeDeep(this.observer)
  }

  private notifyChange(): void {
    const snapshot = this.getSnapshot()
    for (const cb of this.changeCallbacks) {
      try {
        cb(snapshot)
      } catch (e) {
        logger.error('评论变化回调执行失败', e)
      }
    }
  }

  private notifyError(type: CommentErrorType, message: string): void {
    for (const cb of this.errorCallbacks) {
      try {
        cb(type, message)
      } catch (e) {
        logger.error('评论错误回调执行失败', e)
      }
    }
  }

  private ensureCommentMap(): Y.Map<Y.Map<unknown>> {
    if (!this.commentMap) throw new Error('评论服务未连接')
    return this.commentMap
  }

  private ensureUserInfo(): CommentUserInfo {
    if (!this.userInfo) throw new Error('用户信息不可用')
    return this.userInfo
  }
}
