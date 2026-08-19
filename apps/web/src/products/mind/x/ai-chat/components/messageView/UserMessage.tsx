// @ts-nocheck — desktop mirror of cloud AI chat; runtime bridged via bridge.tsx
/**
 * UserMessage - 用户消息组件
 *
 * 用户消息与底部输入框是同一个组件 MessageComposerBox 的两种状态：
 *   - 默认收起态：编辑器只读、底部工具栏收起，仅展示已发送内容与图片附件。
 *   - 点击后展开态：原地展开底部工具栏并允许编辑，DOM 与编辑器实例不变。
 * 失焦 / Esc / 点击卡片外都会收起回只读态；确认后重新发送。
 */

import React, { useMemo, useCallback, useEffect, useRef, useState } from 'react'
import type { UIMessage } from '@ai-sdk/react'
import { useAIChatV2Store } from '../../../ai-chat/stores/useAIChatV2Store'
import { logger } from '@zoeymind/logger'
import { ConfirmDialog } from '@zoeymind/ui'
import { useTranslation } from '@zoeymind/i18n'
import { MessageComposerBox } from '../../../ai-chat/components/inputView/MessageComposerBox'
import { useImageAttachmentManager } from '../../../ai-chat/components/inputView/useImageAttachmentManager'
import { useMindMapStore } from '@/products/mind/features/mindmap/stores/mindmap-store'
import type { AIModel } from '../../../ai-chat/hooks/useModelSelector'
import type { Attachment, GenericMessagePart } from '../../../ai-chat/types'

interface UserMessageProps {
  message: UIMessage
  models: AIModel[]
  selectedModel: string
  setSelectedModel: (modelId: string) => void
  onOpenPromptManager: () => void
}

const UserMessageImpl: React.FC<UserMessageProps> = ({
  message,
  models,
  selectedModel,
  setSelectedModel,
  onOpenPromptManager
}) => {
  const { t } = useTranslation()
  const { mindMap: storeMindMap } = useMindMapStore()
  const { resendMessageFrom } = useAIChatV2Store()
  const [isEditing, setIsEditing] = useState(false)
  const [draftMessage, setDraftMessage] = useState('')
  const [draftAttachments, setDraftAttachments] = useState<Attachment[]>([])
  const [showResendConfirm, setShowResendConfirm] = useState(false)
  const [isResending, setIsResending] = useState(false)
  const composerCardRef = useRef<HTMLDivElement | null>(null)

  const currentModel = models.find(model => model.id === selectedModel)
  const supportsVision = currentModel?.hasVision ?? false

  const setInlineDraftAttachments = useCallback(
    (attachmentsOrUpdater: Attachment[] | ((previous: Attachment[]) => Attachment[])) => {
      setDraftAttachments(previousAttachments =>
        typeof attachmentsOrUpdater === 'function'
          ? attachmentsOrUpdater(previousAttachments)
          : attachmentsOrUpdater
      )
    },
    []
  )

  const { isCompressing, addImageFiles } = useImageAttachmentManager({
    supportsVision,
    setAttachments: setInlineDraftAttachments,
    logPrefix: '[AIchatV2 UserMessage]'
  })

  // 收集文本内容
  const textParts = useMemo(() => {
    if (!message.parts) return []
    return message.parts.filter(part => part.type === 'text')
  }, [message.parts])

  // 收集图片附件
  const imageParts = useMemo(() => {
    if (!message.parts) return []
    return message.parts.filter(part => {
      const genericPart = part as GenericMessagePart
      if (genericPart.type === 'image' && 'image' in genericPart) return true
      if (genericPart.type === 'file' && genericPart.url) {
        const isImage =
          genericPart.mediaType?.startsWith('image/') ||
          genericPart.filename?.match(/\.(jpg|jpeg|png|gif|webp)$/i)
        return isImage
      }
      return false
    })
  }, [message.parts])

  // 消息文本归一化为 MentionEditor 使用的 @[name](id) 标记格式
  const messageText = useMemo(() => {
    return textParts
      .map(part => {
        const textContent = typeof part.text === 'string' ? part.text : String(part.text)
        return textContent
          .replace(
            new RegExp('<span class="mention-tag" data-node-id="([^"]+)"[^>]*>([^<]+)</span>', 'g'),
            '@[$2]($1)'
          )
          .replace(
            /<span\s+class="[^"]*\bmention-tag\b[^"]*"[^>]*data-node-id="([^"]+)"[^>]*>([^<]+)<\/span>/g,
            '@[$2]($1)'
          )
      })
      .join('\n')
      .trim()
  }, [textParts])

  // 消息自带的图片附件（收起态与展开态都展示）
  const messageAttachments = useMemo<Attachment[]>(() => {
    return imageParts
      .map((part, index) => {
        const genericPart = part as GenericMessagePart
        if (genericPart.type === 'image' && genericPart.image) {
          return {
            id: `image-${index}`,
            type: 'image' as const,
            name: 'image',
            dataUrl: genericPart.image
          }
        }
        if (genericPart.type === 'file' && genericPart.url) {
          return {
            id: `file-${index}`,
            type: 'image' as const,
            name: genericPart.filename || 'image',
            dataUrl: genericPart.url
          }
        }
        return null
      })
      .filter(Boolean) as Attachment[]
  }, [imageParts])

  // 展开编辑：把消息内容灌入草稿；收起态直接展示消息内容本身
  const displayValue = isEditing ? draftMessage : messageText
  const displayAttachments = isEditing ? draftAttachments : messageAttachments

  const handleStartEditing = useCallback(() => {
    if (isEditing) return
    setDraftMessage(messageText)
    setDraftAttachments(messageAttachments)
    setIsEditing(true)
  }, [isEditing, messageText, messageAttachments])

  const handleCancelEditing = useCallback(() => {
    setIsEditing(false)
    setShowResendConfirm(false)
  }, [])

  const handleRequestResend = useCallback(() => {
    if (!draftMessage.trim() && draftAttachments.length === 0) return
    setShowResendConfirm(true)
  }, [draftMessage, draftAttachments.length])

  const handleEditorKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      handleCancelEditing()
      return
    }

    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      handleRequestResend()
    }
  }

  // 失焦范围限定在整个 Chat 面板内（含底部输入框）：点面板内（编辑卡片以外，含底部输入/历史区）都收起；
  // 点画布 / 其他浮层（模型下拉、确认框等 Portal 到面板外）都不收起。Esc 始终可收起。
  useEffect(() => {
    if (!isEditing) return

    const panelContainer =
      composerCardRef.current?.closest<HTMLElement>('[data-ai-chat-panel]') ?? null
    const pointerTarget: HTMLElement | Document = panelContainer ?? document

    const handlePanelPointerDown = (event: Event) => {
      if (showResendConfirm || isResending) return

      const targetNode = event.target
      const composerCardElement = composerCardRef.current
      if (targetNode instanceof Node && composerCardElement?.contains(targetNode)) return

      handleCancelEditing()
    }

    const handleDocumentKeyDown = (event: KeyboardEvent) => {
      if (showResendConfirm || isResending) return
      if (event.key !== 'Escape') return

      event.preventDefault()
      handleCancelEditing()
    }

    pointerTarget.addEventListener('pointerdown', handlePanelPointerDown, true)
    document.addEventListener('keydown', handleDocumentKeyDown, true)

    return () => {
      pointerTarget.removeEventListener('pointerdown', handlePanelPointerDown, true)
      document.removeEventListener('keydown', handleDocumentKeyDown, true)
    }
  }, [handleCancelEditing, isEditing, isResending, showResendConfirm])

  const handleRemoveDraftAttachment = (index: number) => {
    setDraftAttachments(currentAttachments =>
      currentAttachments.filter((_, itemIndex) => itemIndex !== index)
    )
  }

  const handleConfirmResend = async () => {
    const wsid = (storeMindMap as { workspaceId?: string } | null)?.workspaceId
    if (!wsid) {
      logger.warn('[UserMessage] 无法重新发送: mindMap.workspaceId 缺失', {
        hasStoreMindMap: !!storeMindMap,
        messageId: message.id
      })
      return
    }

    setIsResending(true)
    try {
      await resendMessageFrom(
        message.id,
        {
          text: draftMessage,
          attachments: draftAttachments
        },
        wsid,
        selectedModel,
        currentModel?.provider
      )
      setShowResendConfirm(false)
      setIsEditing(false)
    } catch (error) {
      logger.error('[UserMessage] 重新发送消息失败', { error, messageId: message.id })
    } finally {
      setIsResending(false)
    }
  }

  return (
    <>
      <div
        ref={composerCardRef}
        className="flex flex-col items-start"
        role={isEditing ? undefined : 'button'}
        tabIndex={isEditing ? -1 : 0}
        onClick={isEditing ? undefined : handleStartEditing}
        onKeyDown={
          isEditing
            ? undefined
            : event => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  handleStartEditing()
                }
              }
        }
      >
        <MessageComposerBox
          value={displayValue}
          onChange={setDraftMessage}
          onKeyDown={handleEditorKeyDown}
          attachments={displayAttachments}
          onRemoveAttachment={handleRemoveDraftAttachment}
          models={models}
          selectedModel={selectedModel}
          setSelectedModel={setSelectedModel}
          onSend={handleRequestResend}
          onAddImage={addImageFiles}
          onOpenPromptManager={onOpenPromptManager}
          expanded={isEditing}
          disabled={isResending}
          isSending={false}
          isCompressing={isCompressing}
          supportsVision={supportsVision}
          className={composerCardClassName(isEditing)}
        />
      </div>

      <ConfirmDialog
        open={showResendConfirm}
        onOpenChange={open => !open && setShowResendConfirm(false)}
        title={t('mindmap.aiChat.message.resendConfirmTitle')}
        description={t('mindmap.aiChat.message.resendConfirmDescription')}
        confirmText={t('mindmap.aiChat.message.confirmResend')}
        cancelText={t('common.cancel')}
        onConfirm={handleConfirmResend}
        loading={isResending}
      />
    </>
  )
}

// 与 AssistantMessage 同理: 流式期间 MessageView 每 token 重渲染, 用户消息已定稿,
// memo 后 message 引用不变即跳过. 依赖上游 setSelectedModel / onOpenPromptManager 为稳定引用.
export const UserMessage = React.memo(UserMessageImpl)

/**
 * 收起只读态：整卡可点击（pointer + hover 高亮）。
 * 编辑态：不设卡片光标，交由内部输入区显示文字（text）光标。
 */
function composerCardClassName(isEditing: boolean): string {
  return isEditing ? 'w-full' : 'w-full cursor-pointer transition-colors hover:border-primary/30'
}
