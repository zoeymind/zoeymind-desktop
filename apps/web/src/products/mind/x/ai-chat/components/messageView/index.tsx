// @ts-nocheck — dormant AI chat / MCP module (bridge.tsx flattens to no-op)
import React, { useState, useEffect } from 'react'
import { UserMessage } from './UserMessage'
import { AssistantMessage } from './AssistantMessage'
import { useAutoScroll } from './useAutoScroll'
import { useAIChatRuntime } from '../../../ai-chat/context/AIChatRuntimeContext'
import { hasRenderableContent } from '../../../ai-chat/utils/message-content'
import { Spinner } from '@zoeymind/ui'
import { ChevronUp } from 'lucide-react'
import { useTranslation } from '@zoeymind/i18n'
import type { AIModel } from '../../../ai-chat/hooks/useModelSelector'

const MESSAGES_PER_PAGE = 10

interface MessageViewProps {
  onScrollStatusChange?: (isNearBottom: boolean) => void
  models: AIModel[]
  selectedModel: string
  setSelectedModel: (modelId: string) => void
  onOpenPromptManager: () => void
}

export const MessageView: React.FC<MessageViewProps> = ({
  onScrollStatusChange,
  models,
  selectedModel,
  setSelectedModel,
  onOpenPromptManager
}) => {
  const { t } = useTranslation()
  // ✅ 从 runtime 读 messages + status (AI SDK 单一事实源)
  const { messages, status } = useAIChatRuntime()
  const isProcessing = status === 'submitted' || status === 'streaming'
  const [displayCount, setDisplayCount] = useState(MESSAGES_PER_PAGE)

  const { containerRef, messagesEndRef } = useAutoScroll({
    messages,
    isSending: isProcessing,
    onScrollStatusChange
  })

  // 计算要显示的消息
  const visibleMessages = messages.slice(-displayCount)
  const hasMoreMessages = messages.length > displayCount

  // 加载更多消息
  const loadMoreMessages = () => {
    if (!containerRef.current) return

    // 记录当前内容高度
    const container = containerRef.current
    const scrollHeight = container.scrollHeight

    const newDisplayCount = Math.min(displayCount + MESSAGES_PER_PAGE, messages.length)
    setDisplayCount(newDisplayCount)

    // 在下一个渲染周期后调整滚动位置，保持视觉位置不变
    requestAnimationFrame(() => {
      // 如果之前就在顶部或接近顶部，我们需要加上新增内容的高度
      handleScrollAdjustment(scrollHeight)
    })
  }

  const handleScrollAdjustment = (prevScrollHeight: number) => {
    const container = containerRef.current
    if (!container) return

    requestAnimationFrame(() => {
      const addedHeight = container.scrollHeight - prevScrollHeight
      container.scrollTop += addedHeight
    })
  }

  // 重置显示数量（当对话切换时）
  useEffect(() => {
    if (messages.length > 0 && messages.length <= MESSAGES_PER_PAGE) {
      setDisplayCount(MESSAGES_PER_PAGE)
    }
  }, [messages.length])

  return (
    <div ref={containerRef} className="h-full overflow-y-auto">
      <div className="flex flex-col p-4">
        {/* 加载更多按钮 */}
        {hasMoreMessages && (
          <button
            type="button"
            onClick={loadMoreMessages}
            className="flex items-center justify-center space-x-1 py-1.5 px-3 bg-muted/50 hover:bg-muted rounded-lg text-xs text-muted-foreground transition-colors mx-auto mb-4 border border-border"
          >
            <ChevronUp className="size-3" />
            <span>{t('mindmap.aiChat.message.viewHistory')}</span>
          </button>
        )}

        {visibleMessages.map((message, index) => {
          const isLast = index === visibleMessages.length - 1
          if (message.role === 'user') {
            return (
              <UserMessage
                key={message.id}
                message={message}
                models={models}
                selectedModel={selectedModel}
                setSelectedModel={setSelectedModel}
                onOpenPromptManager={onOpenPromptManager}
              />
            )
          }
          if (message.role === 'assistant') {
            return (
              <AssistantMessage
                key={message.id}
                message={message}
                isLast={isLast}
                isProcessing={isProcessing}
              />
            )
          }
          return null
        })}
        {/* 等待 spinner (官方判定, docs/research/ai-sdk-chat-streaming.md §4.1):
            - submitted: assistant 消息还没 push 到 messages, 直接显示
            - streaming 但 last assistant 尚无可渲染内容 (含空 text part 瞬态): 显示
            有内容后由 AssistantMessage 尾部的 spinner 接管. */}
        {isProcessing &&
          (() => {
            const lastMsg = messages[messages.length - 1]
            const waitingFirstContent =
              !lastMsg || lastMsg.role === 'user' || !hasRenderableContent(lastMsg)
            if (waitingFirstContent) {
              return (
                <div className="pl-2 mt-2">
                  <Spinner variant="ellipsis" size={16} className="text-foreground" />
                </div>
              )
            }
            return null
          })()}

        <div ref={messagesEndRef} data-scroll-end />
      </div>
    </div>
  )
}