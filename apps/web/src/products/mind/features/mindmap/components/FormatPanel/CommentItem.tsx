import { FC, useState, useCallback, useEffect } from 'react'
import { useTranslation } from '@zoeymind/i18n'
import { UserAvatarWithCard } from '@/shared/app-shared'
import { CommentTextarea } from './CommentTextarea'
import { useUserStore } from '@/products/mind/stores'
import { MoreHorizontal } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@zoeymind/ui'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@zoeymind/ui'
import { Button } from '@zoeymind/ui'
import { formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'

import type { CommentData } from '@zoeymind/shared'

interface CommentItemProps {
  comment: CommentData
  onUpdate: (commentId: string, content: string, mentions: string[]) => Promise<CommentData | null>
  onDelete: (commentId: string) => Promise<void>
  onEditStateChange?: (isEditing: boolean) => void // 新增：编辑状态变化回调
}

export const CommentItem: FC<CommentItemProps> = ({
  comment,
  onUpdate,
  onDelete,
  onEditStateChange
}) => {
  const { t } = useTranslation()
  const [showEditForm, setShowEditForm] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const { user: currentUser } = useUserStore()

  // 监听编辑状态变化并通知父组件
  useEffect(() => {
    if (onEditStateChange) {
      onEditStateChange(showEditForm)
    }
  }, [showEditForm, onEditStateChange])

  // 检查是否是评论作者（有编辑权限）
  const isCommentAuthor = currentUser && currentUser.id === comment.userId

  // 处理更新
  const handleUpdate = useCallback(
    async (content: string, mentions: string[]) => {
      try {
        await onUpdate(comment.id, content, mentions)
        setShowEditForm(false)
      } catch {
        // 错误已在上层处理
      }
    },
    [onUpdate, comment.id]
  )

  // 处理删除
  const handleDelete = useCallback(async () => {
    setIsDeleting(true)
    try {
      await onDelete(comment.id)
      setShowDeleteDialog(false)
    } finally {
      setIsDeleting(false)
    }
  }, [onDelete, comment.id])

  // 格式化时间
  const formatTime = (dateString: string) => {
    try {
      return formatDistanceToNow(new Date(dateString), {
        addSuffix: true,
        locale: zhCN
      })
    } catch {
      return t('common.time.justNow')
    }
  }

  // 渲染带有 @ 提及高亮的评论内容
  const renderCommentWithMentions = (content: string) => {
    // 匹配 @[用户名](用户ID) 格式
    const mentionRegex = /@\[(.*?)\]\((.*?)\)/g
    const parts: React.ReactNode[] = []
    let lastIndex = 0
    let match

    while ((match = mentionRegex.exec(content)) !== null) {
      // 添加提及之前的普通文本
      if (match.index > lastIndex) {
        parts.push(content.substring(lastIndex, match.index))
      }

      // 添加提及标签（绿色高亮，和 AI 输入框颜色保持一致）
      parts.push(
        <span
          key={match.index}
          className="rounded bg-success/20 dark:bg-success/25 text-success dark:text-success px-1 font-medium"
        >
          @{match[1]}
        </span>
      )

      lastIndex = match.index + match[0].length
    }

    // 添加剩余的普通文本
    if (lastIndex < content.length) {
      parts.push(content.substring(lastIndex))
    }

    return parts.length > 0 ? parts : content
  }

  return (
    <div className="reply card-panel-reply reply__show group">
      {/* 飞书风格的评论主体 */}
      <div className="reply__main flex gap-2">
        {/* 用户头像 */}
        <UserAvatarWithCard
          user={{
            id: comment.userId,
            name: comment.user?.name ?? comment.userName ?? undefined,
            avatar: comment.user?.avatar ?? undefined
          }}
          size="sm"
          className="flex-shrink-0 cursor-pointer"
        />

        {/* 评论右侧内容 */}
        <div className="reply__main__right flex-1 min-w-0">
          {/* 用户信息行 + hover功能按钮 */}
          <div className="reply__main__right__info flex items-center justify-between mb-1">
            <div className="reply__main__right__info__text flex items-center gap-2">
              <span className="reply__main__right__info__text__name reply-info-text-name text-xs font-medium text-foreground">
                {comment.user?.name || comment.userName || t('common.anonymousUser')}
              </span>
              <span className="reply__main__right__info__text__time text-xs text-muted-foreground">
                {formatTime(comment.createdAt)}
              </span>
              {(() => {
                const created = new Date(comment.createdAt).getTime()
                const updated = new Date(comment.updatedAt).getTime()
                const isEdited = updated > created + 1000 // 1秒的容差
                return (
                  isEdited && (
                    <span className="text-xs text-muted-foreground/70">
                      {t('mindmap.formatPanel.comment.edited')}
                    </span>
                  )
                )
              })()}
            </div>

            {/* hover显示的操作按钮 - 只有评论作者才能看到 */}
            {!showEditForm && isCommentAuthor && (
              <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                <DropdownMenu>
                  <DropdownMenuTrigger
                    nativeButton
                    render={
                      <button
                        type="button"
                        className="text-xs text-muted-foreground hover:text-foreground transition-colors p-0.5 rounded hover:bg-muted"
                      >
                        <MoreHorizontal className="size-3" />
                      </button>
                    }
                  />
                  <DropdownMenuContent align="end" className="w-16">
                    <DropdownMenuItem onClick={() => setShowEditForm(true)} className="text-xs">
                      {t('common.edit')}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => setShowDeleteDialog(true)}
                      className="text-xs text-destructive"
                    >
                      {t('common.delete')}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}
          </div>

          {/* 评论内容区域 */}
          <div className="mt-1">
            {showEditForm ? (
              // 编辑模式：在原位置显示输入框
              <CommentTextarea
                onSubmit={handleUpdate}
                onCancel={() => setShowEditForm(false)}
                initialValue={comment.content}
                placeholder={t('mindmap.formatPanel.comment.editPlaceholder')}
                compact={true}
                autoFocus={true}
              />
            ) : (
              // 显示模式：评论内容（带 @ 提及高亮）
              <div className="text-xs text-foreground whitespace-pre-wrap break-words">
                {renderCommentWithMentions(comment.content)}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 删除确认对话框 */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('mindmap.formatPanel.comment.deleteDialogTitle')}</DialogTitle>
            <DialogDescription>
              {t('mindmap.formatPanel.comment.deleteDialogDesc')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
              disabled={isDeleting}
            >
              {t('common.cancel')}
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? t('mindmap.formatPanel.comment.deleting') : t('common.delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
