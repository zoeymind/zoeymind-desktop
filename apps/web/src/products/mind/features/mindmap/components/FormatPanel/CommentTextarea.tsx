import { FC, useState, useEffect, useCallback } from 'react'
import { useTranslation } from '@zoeymind/i18n'
import { Button } from '@zoeymind/ui'
import { logger } from '@zoeymind/logger'
import { trpcClient } from '@/shared/app-shared'
import { useProjectContext } from '@/products/mind/features/mindmap/contexts/ProjectContext'
import {
  MentionEditor,
  type MentionEditorSuggestion
} from '@/products/mind/features/mindmap/components/MentionEditor/MentionEditor'

interface CommentTextareaProps {
  placeholder?: string
  onSubmit: (content: string, mentions: string[]) => Promise<void>
  onCancel?: () => void
  autoFocus?: boolean
  compact?: boolean
  initialValue?: string
}

interface Collaborator {
  id: string
  display: string
  avatar?: string | null
}

/** 从评论文本中提取被 @ 的用户 id（@[name](id) 格式，与下游通知一致） */
function extractMentions(content: string): string[] {
  const mentionRegex = /@\[(.*?)\]\((.*?)\)/g
  const mentions: string[] = []
  let match
  while ((match = mentionRegex.exec(content)) !== null) {
    const userId = match[2]
    if (userId && !mentions.includes(userId)) {
      mentions.push(userId)
    }
  }
  return mentions
}

export const CommentTextarea: FC<CommentTextareaProps> = ({
  placeholder,
  onSubmit,
  onCancel,
  autoFocus = false,
  compact = false,
  initialValue = ''
}) => {
  const { t } = useTranslation()
  const effectivePlaceholder = placeholder ?? t('mindmap.formatPanel.comment.replyPlaceholder')
  const [content, setContent] = useState(initialValue)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [collaborators, setCollaborators] = useState<Collaborator[]>([])
  const { workspaceId: mindmapId } = useProjectContext()

  // 获取协作者列表(组织成员)
  const fetchCollaborators = useCallback(async () => {
    if (!mindmapId) return
    try {
      const result = await trpcClient.mindmap.permission.collaborators.query({ mindmapId })
      if (result.success && result.collaborators) {
        logger.info('CommentTextarea: 获取协作者列表成功', {
          count: result.collaborators.length
        })
        setCollaborators(result.collaborators)
      } else {
        logger.warn('CommentTextarea: 协作者列表为空')
      }
    } catch (error) {
      logger.error('CommentTextarea: 获取协作者列表失败', error)
    }
  }, [mindmapId])

  // 同步初始值变化
  useEffect(() => {
    setContent(initialValue)
  }, [initialValue])

  // 自动聚焦时预拉取协作者
  useEffect(() => {
    if (autoFocus) {
      fetchCollaborators()
    }
  }, [autoFocus, fetchCollaborators])

  const handleSubmit = async () => {
    const trimmedContent = content.trim()
    if (!trimmedContent) return
    try {
      setIsSubmitting(true)
      const mentions = extractMentions(trimmedContent)
      await onSubmit(trimmedContent, mentions)
      // 编辑模式下不清空内容，新评论模式下才清空
      if (!initialValue) {
        setContent('')
      }
    } catch {
      // 错误已在上层处理
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCancel = () => {
    setContent(initialValue || '')
    onCancel?.()
  }

  // Cmd/Ctrl+Enter 提交，Escape 取消
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      handleSubmit()
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      handleCancel()
    }
  }

  const handleSearch = useCallback(
    (query: string): MentionEditorSuggestion[] => {
      const q = query.toLowerCase()
      return collaborators
        .filter(c => (q ? c.display.toLowerCase().includes(q) : true))
        .map(c => ({ value: c.display, id: c.id, avatar: c.avatar }))
    },
    [collaborators]
  )

  const showButtons = content.trim().length > 0 || !!initialValue
  const canSubmit = content.trim().length > 0 && !isSubmitting

  return (
    <div className="textarea">
      <div className="textarea__main-wrapper">
        <div className="textarea__main">
          <div
            className={`textarea__main__editor-wrapper rounded-md relative px-2 ${
              showButtons ? 'bg-muted/50' : 'bg-transparent hover:bg-muted/50'
            }`}
          >
            <MentionEditor
              value={content}
              onChange={setContent}
              onKeyDown={handleKeyDown}
              onSearch={handleSearch}
              onMentionTrigger={fetchCollaborators}
              showAvatar
              placeholder={effectivePlaceholder}
              disabled={isSubmitting}
              compact={compact}
              autoFocus={autoFocus}
              pillClassName="rounded bg-success/20 dark:bg-success/25 text-success px-0.5"
            />
          </div>

          {/* 飞书风格的操作按钮区域 */}
          {showButtons && (
            <div className="textarea__permission flex justify-end mt-2">
              <div className="textarea-operation flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleCancel}
                  disabled={isSubmitting}
                  className="h-8"
                >
                  {t('common.cancel')}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleSubmit}
                  disabled={!canSubmit}
                  className="h-8"
                >
                  {isSubmitting
                    ? t('mindmap.formatPanel.comment.sending')
                    : t('mindmap.formatPanel.comment.send')}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
