import { FC, useEffect, useRef, useCallback, useState } from 'react'
import { useTranslation } from '@zoeymind/i18n'
import { CommentItem } from './CommentItem'
import { CommentTextarea } from './CommentTextarea'
import { logger } from '@zoeymind/logger'
import { useMindMapStore } from '@/products/mind/features/mindmap/stores/mindmap-store'
import { useProjectContext } from '@/products/mind/features/mindmap/contexts/ProjectContext'
import { useCommentContext } from '@/products/mind/features/mindmap/contexts/CommentContext'
import { trpcClient } from '@/shared/app-shared'
import type { CommentData } from '@zoeymind/shared'

interface NodeCommentBlockProps {
  nodeUid: string
  stats?: {
    count: number
    hasUnread?: boolean
    latestComment?: {
      content: string
      userName: string
      createdAt: string
    }
  }
  isTarget?: boolean
  onNavigateToNext?: (currentNodeUid: string) => void
  onNavigateToPrev?: (currentNodeUid: string) => void
  onCardClick?: (nodeUid: string) => void // 新增：卡片点击回调
}

export const NodeCommentBlock: FC<NodeCommentBlockProps> = ({
  nodeUid,
  isTarget,
  onNavigateToNext,
  onNavigateToPrev,
  onCardClick
}) => {
  const { t } = useTranslation()
  // 从store获取mindMap实例
  const { mindMap } = useMindMapStore()
  // 从ProjectContext获取projectId
  const { workspaceId } = useProjectContext()
  const blockRef = useRef<HTMLDivElement>(null)
  const [nodeName, setNodeName] = useState<string>(
    t('mindmap.formatPanel.comment.nodeFallback', { suffix: nodeUid.slice(-6) })
  )
  const [showNewCommentInput, setShowNewCommentInput] = useState(false)
  const [hasEditingComment, setHasEditingComment] = useState(false)

  // 从 CommentContext 获取 service 和评论数据
  const { service: commentService, comments: allComments } = useCommentContext()
  const comments = allComments[nodeUid] ?? []
  const loading = false

  // 获取节点真实内容
  useEffect(() => {
    if (!mindMap || !nodeUid) {
      logger.debug('mindMap或nodeUid为空:', { mindMap: !!mindMap, nodeUid })
      return
    }

    const updateNodeName = () => {
      try {
        // ✅ 使用 simple-mind-map 的 findNodeDataByUid 方法
        const targetNode = mindMap.renderer.findNodeDataByUid?.(nodeUid)
        logger.debug('查找节点结果:', { nodeUid, targetNode: !!targetNode })

        if (targetNode) {
          // 从数据中直接获取节点文本
          const nodeText =
            targetNode.data?.text ||
            t('mindmap.formatPanel.comment.nodeFallback', { suffix: nodeUid.slice(-6) })
          setNodeName(nodeText)
        } else {
          logger.warn('未找到节点:', nodeUid)
          setNodeName(t('mindmap.formatPanel.comment.nodeDeleted'))
        }
      } catch (error) {
        logger.error('获取节点内容失败:', error)
        setNodeName(t('mindmap.formatPanel.comment.nodeFallback', { suffix: nodeUid.slice(-6) }))
      }
    }

    // 立即尝试更新
    updateNodeName()

    // 监听思维导图渲染完成事件，确保节点已经渲染
    const handleRenderEnd = () => {
      updateNodeName()
    }

    // 监听数据变化事件
    const handleDataChange = () => {
      updateNodeName()
    }

    mindMap.on('node_tree_render_end', handleRenderEnd)
    mindMap.on('data_change', handleDataChange)

    return () => {
      mindMap.off('node_tree_render_end', handleRenderEnd)
      mindMap.off('data_change', handleDataChange)
    }
  }, [mindMap, nodeUid])

  // WebSocket 事件监听已移至 useCommentYJS hook 中处理

  // 处理目标节点定位
  useEffect(() => {
    if (isTarget && blockRef.current) {
      // 滚动到目标节点
      blockRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      })

      // 显示新评论输入框（用于右键菜单调用）
      setShowNewCommentInput(true)
    } else {
      // 不是目标节点时隐藏输入框
      setShowNewCommentInput(false)
    }
  }, [isTarget])

  // 处理添加评论
  const handleAddComment = async (content: string, mentions: string[]) => {
    try {
      // 1. 添加评论到 Yjs
      if (!commentService) throw new Error(t('mindmap.formatPanel.comment.errorServiceNotInit'))
      commentService.addComment(nodeUid, content)
      setShowNewCommentInput(false)
      logger.info('评论添加成功')

      // 2. 发送通知（包含 @ 提及和所有者订阅）
      if (workspaceId) {
        try {
          await trpcClient.mindmap.comment.sendMentionNotification.mutate({
            mindmapId: workspaceId,
            commentContent: content,
            mentions,
            nodeUid,
            nodeText: nodeName // 传递节点的实际文本内容
          })
          logger.info('提及通知发送成功', { mentions })
        } catch (notifyError) {
          logger.error('发送提及通知失败（不影响评论创建）:', notifyError)
        }
      }
    } catch (error) {
      logger.error('添加评论失败:', error)
      throw error // 让上层组件处理错误显示
    }
  }

  // 处理取消新评论
  const handleCancelNewComment = () => {
    setShowNewCommentInput(false)
  }

  // 处理评论编辑状态变化
  const handleCommentEditStateChange = (isEditing: boolean) => {
    setHasEditingComment(isEditing)
    if (isEditing) {
      setShowNewCommentInput(false)
    }
  }

  // 处理更新评论
  const handleUpdateComment = async (
    commentId: string,
    content: string,
    mentions: string[]
  ): Promise<CommentData | null> => {
    try {
      // 1. 更新评论到 Yjs
      if (!commentService) throw new Error(t('mindmap.formatPanel.comment.errorServiceNotInit'))
      const updatedComment = commentService.updateComment(commentId, content)
      logger.info('评论更新成功:', updatedComment)

      // 2. 发送通知（包含 @ 提及和所有者订阅）
      if (workspaceId) {
        try {
          await trpcClient.mindmap.comment.sendMentionNotification.mutate({
            mindmapId: workspaceId,
            commentContent: content,
            mentions,
            nodeUid,
            nodeText: nodeName // 传递节点的实际文本内容
          })
          logger.info('提及通知发送成功（更新评论）', { mentions })
        } catch (notifyError) {
          logger.error('发送提及通知失败（不影响评论更新）:', notifyError)
        }
      }

      return updatedComment
    } catch (error) {
      logger.error('更新评论失败:', error)
      throw error // 让上层组件处理错误显示
    }
  }

  // 处理删除评论
  const handleDeleteComment = async (commentId: string) => {
    try {
      if (!commentService) throw new Error(t('mindmap.formatPanel.comment.errorServiceNotInit'))
      commentService.deleteComment(commentId)
      logger.info('评论删除成功')
    } catch (error) {
      logger.error('删除评论失败:', error)
      throw error // 让上层组件处理错误显示
    }
  }

  // 处理卡片点击，激活对应节点
  const handleCardClick = useCallback(
    (e: React.MouseEvent) => {
      // 防止事件冒泡到父元素
      e.stopPropagation()

      // 通知父组件使用统一的激活方法
      if (onCardClick) {
        onCardClick(nodeUid)
      }
    },
    [nodeUid, onCardClick]
  )

  // 处理回复按钮点击
  const handleReplyClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    setShowNewCommentInput(true)
  }, [])

  // 处理上一个评论按钮
  const handleNavigateToPrev = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      if (onNavigateToPrev) {
        onNavigateToPrev(nodeUid)
      }
    },
    [onNavigateToPrev, nodeUid]
  )

  // 处理下一个评论按钮
  const handleNavigateToNext = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      if (onNavigateToNext) {
        onNavigateToNext(nodeUid)
      }
    },
    [onNavigateToNext, nodeUid]
  )

  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="h-4 bg-muted rounded w-1/3 mb-2"></div>
        <div className="h-16 bg-muted rounded"></div>
      </div>
    )
  }

  return (
    <div
      ref={blockRef}
      className={`bg-card border border-border rounded-lg transition-all duration-500 relative group/card ${
        isTarget
          ? 'shadow-lg' // 激活时的正常阴影
          : 'shadow-sm cursor-pointer hover:shadow-md hover:border-muted-foreground/30'
      }`}
      style={
        isTarget
          ? {
              borderTop: '2px solid hsl(var(--success))',
              borderTopLeftRadius: '0.5rem',
              borderTopRightRadius: '0.5rem'
            }
          : {}
      }
      onClick={handleCardClick}
    >
      {/* 飞书风格的节点头部 */}
      <div className="group/header px-3 pt-3 pb-1 flex items-center justify-between">
        {/* 左边：灰色竖杠 + 灰色节点内容 */}
        <div className="flex items-center gap-2">
          <div className="w-1 h-4 bg-muted-foreground/50 rounded-sm"></div>
          <span
            className={`text-xs font-medium ${
              nodeName === t('mindmap.formatPanel.comment.nodeDeleted')
                ? 'text-muted-foreground line-through bg-muted px-1 py-0.5 rounded'
                : 'text-muted-foreground'
            }`}
            title={nodeName}
          >
            {nodeName}
          </span>
        </div>

        {/* 右边：hover显示的功能按钮组 */}
        <div
          className={`flex items-center gap-1 transition-opacity ${
            isTarget ? 'opacity-100' : 'opacity-0 group-hover/card:opacity-100'
          }`}
          onClick={e => e.stopPropagation()}
        >
          {/* 上一个评论按钮 */}
          <button
            type="button"
            className="p-1 text-muted-foreground hover:text-foreground hover:bg-muted rounded text-xs"
            onClick={handleNavigateToPrev}
            title={t('mindmap.formatPanel.comment.prevTooltip')}
          >
            <svg className="size-3" fill="currentColor" viewBox="0 0 24 24">
              <path d="M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6z" />
            </svg>
          </button>

          {/* 下一个评论按钮 */}
          <button
            type="button"
            className="p-1 text-muted-foreground hover:text-foreground hover:bg-muted rounded text-xs"
            onClick={handleNavigateToNext}
            title={t('mindmap.formatPanel.comment.nextTooltip')}
          >
            <svg className="size-3" fill="currentColor" viewBox="0 0 24 24">
              <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6z" />
            </svg>
          </button>

          {/* 分隔线 */}
          <div className="w-px h-3 bg-border mx-1"></div>

          {/* 完成标记按钮 */}
          <button
            type="button"
            className="p-1 text-muted-foreground hover:text-success hover:bg-success/10 dark:hover:bg-success/15 rounded text-xs"
          >
            <svg className="size-3" fill="currentColor" viewBox="0 0 24 24">
              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
            </svg>
          </button>
        </div>
      </div>

      {/* 卡片内容区域 */}
      <div className="px-3 pb-3">
        {/* 评论列表 */}
        {comments.length > 0 && (
          <div className="space-y-3 mb-3">
            {comments.map(comment => (
              <CommentItem
                key={comment.id}
                comment={comment}
                onUpdate={handleUpdateComment}
                onDelete={handleDeleteComment}
                onEditStateChange={handleCommentEditStateChange}
              />
            ))}
          </div>
        )}

        {/* 回复按钮或新评论输入框 */}
        {showNewCommentInput && !hasEditingComment ? (
          <div onClick={e => e.stopPropagation()}>
            <CommentTextarea
              placeholder={t('mindmap.formatPanel.comment.replyPlaceholder')}
              onSubmit={handleAddComment}
              onCancel={handleCancelNewComment}
              compact={true}
              autoFocus={true}
            />
          </div>
        ) : (
          !hasEditingComment && (
            <button
              type="button"
              onClick={handleReplyClick}
              className="text-xs text-muted-foreground hover:text-primary transition-colors"
            >
              {t('mindmap.formatPanel.comment.replyButton')}
            </button>
          )
        )}
      </div>
    </div>
  )
}
