/**
 * useCommentService - 评论协同的薄 React hook
 *
 * 职责清晰分离：
 * - CommentService (class): Y.Doc 生命周期、WebSocket、CRUD、HTTP 预加载
 * - useCommentService (本 hook): React 状态管理、连接生命周期、mindMap 同步、toast 通知
 *
 * 设计原则：
 * - 只有 3 个 useEffect，每个职责明确
 * - 依赖数组完全诚实，不需要 eslint-disable
 * - service 实例通过 useRef 持有，方法引用天然稳定
 */

import { useEffect, useState, useRef } from 'react'
import type { default as MindMap } from 'simple-mind-map'
import { logger } from '@zoeymind/logger'
import { useUserStore, useUIStore } from '@/products/mind/stores'
import { useProjectContext } from '@/products/mind/features/mindmap/contexts/ProjectContext'
import { useToast } from '@/shared/app-shared'
import { i18next } from '@zoeymind/i18n'
import { authClient } from '@/shared/auth'
import {
  CommentService,
  EMPTY_SNAPSHOT,
  type CommentSnapshot,
  type CommentErrorType
} from '@/products/mind/features/mindmap/services/comment-service'

// 全局的已通知评论ID集合，避免跨实例重复通知（key: workspaceId）
const globalNotifiedCommentsMap = new Map<string, Set<string>>()

/**
 * useCommentService - 连接 CommentService 到 React 生命周期
 *
 * @param mindMap - 思维导图实例（用于同步评论统计到画布）
 * @returns service 实例 + 评论数据快照
 */
export function useCommentYJS(mindMap: MindMap | null, _enabled: boolean = true) {
  const { workspaceId, cloudMode } = useProjectContext()
  const { getUserInfo } = useUserStore()
  const { toast } = useToast()
  const { data: sessionData } = authClient.useSession()
  // 只在 token 真正变化时重建 service；获焦 refetch 只改 sessionData 对象引用，token 字符串保持稳定
  const sessionToken = sessionData?.session?.token ?? null

  const serviceRef = useRef<CommentService | null>(null)
  const [snapshot, setSnapshot] = useState<CommentSnapshot>(EMPTY_SNAPSHOT)
  const previousCommentIdsRef = useRef<Set<string>>(new Set())

  // ── Effect 1: 连接管理 ────────────────────────
  // 只在 workspaceId/cloudMode 变化时执行
  useEffect(() => {
    if (!workspaceId || !cloudMode) return

    const service = new CommentService()
    serviceRef.current = service

    // 注册数据变化回调 → 更新 React state
    const unsubChange = service.onChange(newSnapshot => {
      setSnapshot(newSnapshot)
    })

    // 注册错误回调 → 显示 toast
    const unsubError = service.onError((type: CommentErrorType, message: string) => {
      toast({ variant: 'destructive', description: message })
      logger.warn('评论服务错误', { type, message })
    })

    // 获取用户信息并连接
    const userInfo = getUserInfo()

    service.connect(
      workspaceId,
      sessionToken,
      userInfo || {
        id: 'anonymous',
        name: i18next.t('common.anonymousUser'),
        avatar: '',
        userId: 'anonymous'
      }
    )

    // 清理全局通知集合
    globalNotifiedCommentsMap.delete(workspaceId)

    return () => {
      unsubChange()
      unsubError()
      service.disconnect()
      serviceRef.current = null
      setSnapshot(EMPTY_SNAPSHOT)
      previousCommentIdsRef.current = new Set()
    }
    // getUserInfo/toast 是稳定引用（zustand selector / useToast），不需要放入依赖
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId, cloudMode, sessionToken])

  // ── Effect 2: stats → mindMap 同步 ────────────
  // 当评论统计变化或 mindMap 可用时，同步到画布
  useEffect(() => {
    if (!mindMap?.comment || Object.keys(snapshot.stats).length === 0) return

    mindMap.comment.setCommentStats(snapshot.stats)
    mindMap.emit('comment_stats_updated', snapshot.stats)
  }, [mindMap, snapshot.stats])

  // ── Effect 3: 新评论 toast 通知 ────────────────
  // 检测其他用户的新评论并弹出通知
  useEffect(() => {
    if (!cloudMode || !workspaceId) return

    const currentIds = new Set(Object.values(snapshot.comments).flatMap(arr => arr.map(c => c.id)))
    const prevIds = previousCommentIdsRef.current

    // 首次加载（prevIds 为空），只记录不通知
    if (prevIds.size === 0) {
      previousCommentIdsRef.current = currentIds
      return
    }

    // 获取/创建全局已通知集合
    if (!globalNotifiedCommentsMap.has(workspaceId)) {
      globalNotifiedCommentsMap.set(workspaceId, new Set())
    }
    const globalNotified = globalNotifiedCommentsMap.get(workspaceId)!

    const currentUserInfo = getUserInfo()
    const currentUserId = currentUserInfo?.userId || 'anonymous'

    // 找出新增的、未通知过的评论
    for (const id of currentIds) {
      if (prevIds.has(id) || globalNotified.has(id)) continue

      globalNotified.add(id)

      // 在所有评论中查找这条评论
      const comment = Object.values(snapshot.comments)
        .flat()
        .find(c => c.id === id)
      if (!comment || comment.userId === currentUserId) continue

      // 显示 toast 通知
      const preview =
        comment.content.length > 50 ? `${comment.content.substring(0, 50)}...` : comment.content

      toast({
        variant: 'info',
        title: i18next.t('mindmap.toast.commentAddedTitle'),
        description: `${comment.userName}: ${preview}`,
        action: {
          label: i18next.t('mindmap.toast.commentViewNow'),
          onClick: () => {
            if (mindMap && comment.nodeUid) {
              try {
                mindMap.execCommand('GO_TARGET_NODE', comment.nodeUid)
              } catch {
                /* ignore */
              }
            }
            const { openFormatTab } = useUIStore.getState()
            openFormatTab('comment', comment.nodeUid)
          }
        }
      })

      // 每次变化只通知一条新评论
      break
    }

    previousCommentIdsRef.current = currentIds
    // mindMap/getUserInfo/toast 是稳定引用
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshot, cloudMode, workspaceId])

  // ── 返回值 ────────────────────────────────────
  // 保持与原 useCommentYJS 兼容的返回结构
  const service = serviceRef.current
  return {
    comments: snapshot.comments,
    stats: snapshot.stats,
    totalComments: snapshot.total,
    addComment: (nodeUid: string, content: string) => {
      if (!service) throw new Error('评论服务未连接')
      return Promise.resolve(service.addComment(nodeUid, content))
    },
    updateComment: (commentId: string, content: string) => {
      if (!service) throw new Error('评论服务未连接')
      return Promise.resolve(service.updateComment(commentId, content))
    },
    deleteComment: (commentId: string) => {
      if (!service) throw new Error('评论服务未连接')
      service.deleteComment(commentId)
      return Promise.resolve()
    },
    getNodeComments: (nodeUid: string) => snapshot.comments[nodeUid] || [],
    loading: false,
    connected: service?.isConnected() ?? false,
    /** 新增：直接暴露 service 实例，供 CommentContext 使用 */
    service
  }
}
