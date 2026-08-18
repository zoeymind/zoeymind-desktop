// @ts-nocheck — dormant AI chat / MCP module (bridge.tsx flattens to no-op)
/**
 * InputView - 消息输入框 (AIchatV2)
 *
 * 支持文本和图像输入，参考旧版 AIchat 的样式和交互
 * 从 store 读取状态，无需 props 传递
 */

import React from 'react'
import { MessageComposerBox } from './MessageComposerBox'
import { useImageAttachmentManager } from './useImageAttachmentManager'
import { useAIChatRuntime } from '../../context/AIChatRuntimeContext'
import { useAIChatV2Store } from '../../stores/useAIChatV2Store'
import { useMindMapStore } from '@/products/mind/features/mindmap/stores/mindmap-store'
import type { AIModel } from '../../../ai-chat/hooks/useModelSelector'

interface InputViewProps {
  models: AIModel[]
  selectedModel: string
  setSelectedModel: (modelId: string) => void
  onOpenPromptManager: () => void
  disabled?: boolean
}

export const InputView: React.FC<InputViewProps> = ({
  models,
  selectedModel,
  setSelectedModel,
  onOpenPromptManager,
  disabled = false
}) => {
  // 从 store 读取状态 (caseConfirm / simpleAskUser 已搬到 ToolUIRegistry, 不在 store 里)
  const {
    inputMessage,
    setInputMessage,
    attachments,
    setAttachments,
    sendMessage,
    interruptAndSend,
    stopGeneration
  } = useAIChatV2Store()

  const { status } = useAIChatRuntime()
  const isProcessing = status === 'submitted' || status === 'streaming'

  const { mindMap } = useMindMapStore()

  // 判断当前模型是否支持视觉功能
  const currentModel = models.find(m => m.id === selectedModel)
  const supportsVision = currentModel?.hasVision ?? false

  const { isCompressing, addImageFiles } = useImageAttachmentManager({
    supportsVision,
    setAttachments,
    logPrefix: '[AIchatV2 InputView]'
  })

  const handleSend = () => {
    if (disabled) return
    if (!inputMessage.trim() && attachments.length === 0) return
    if (!(mindMap as { workspaceId?: string } | null)?.workspaceId) return

    const provider = currentModel?.provider
    if (isProcessing) {
      interruptAndSend(
        (mindMap as { workspaceId?: string } | null)!.workspaceId!,
        selectedModel,
        provider
      )
      return
    }
    sendMessage((mindMap as { workspaceId?: string } | null)!.workspaceId!, selectedModel, provider)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const removeAttachment = (index: number) => {
    setAttachments(attachments.filter((_, i) => i !== index))
  }

  return (
    <MessageComposerBox
      value={inputMessage}
      onChange={setInputMessage}
      onKeyDown={handleKeyDown}
      attachments={attachments}
      onRemoveAttachment={removeAttachment}
      models={models}
      selectedModel={selectedModel}
      setSelectedModel={setSelectedModel}
      onSend={handleSend}
      onStop={stopGeneration}
      onAddImage={addImageFiles}
      onOpenPromptManager={onOpenPromptManager}
      disabled={disabled}
      isSending={isProcessing}
      isCompressing={isCompressing}
      supportsVision={supportsVision}
      className="mx-3 mb-4"
      dataTour="ai-panel-input"
    />
  )
}