// @ts-nocheck — desktop mirror of cloud AI chat; runtime bridged via bridge.tsx
/**
 * InputView - 消息输入框 (AIchatV2)
 *
 * 支持文本和图像输入，参考旧版 AIchat 的样式和交互
 * 从 store 读取状态，无需 props 传递
 */

import React from "react"
import { MessageComposerBox } from "./MessageComposerBox"
import { useImageAttachmentManager } from "./useImageAttachmentManager"
import { useAIChatRuntime } from "../../context/AIChatRuntimeContext"
import { useAIChatV2Store } from "../../stores/useAIChatV2Store"
import { useProjectMindMapStore as useMindMapStore } from "@/products/mind/editor-session"
import type { AIModel } from "../../../ai-chat/hooks/useModelSelector"
import { hasPendingToolCalls } from "../../../ai-chat/utils/pendingToolCalls"

interface InputViewProps {
  models: AIModel[]
  selectedModel: string
  setSelectedModel: (modelId: string) => void
  disabled?: boolean
  usedTokens: number
  maxTokens: number
}

export const InputView: React.FC<InputViewProps> = ({
  models,
  selectedModel,
  setSelectedModel,
  disabled = false,
  usedTokens,
  maxTokens,
}) => {
  // 从 store 读取状态 (caseConfirm / simpleAskUser 已搬到 ToolUIRegistry, 不在 store 里)
  const {
    inputMessage,
    setInputMessage,
    attachments,
    setAttachments,
    sendMessage,
    interruptAndSend,
    stopGeneration,
  } = useAIChatV2Store()

  const { status, messages } = useAIChatRuntime()
  const isProcessing =
    status === "submitted" || status === "streaming" || hasPendingToolCalls(messages)

  const { mindMap } = useMindMapStore()

  // 判断当前模型是否支持视觉功能
  const currentModel = models.find(m => m.id === selectedModel)
  // 桌面端图片附件始终开放, 不按模型 vision 能力 gate
  const supportsVision = true

  const { isCompressing, addImageFiles } = useImageAttachmentManager({
    supportsVision,
    setAttachments,
    logPrefix: "[AIchatV2 InputView]",
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
    if (e.key === "Enter" && !e.shiftKey) {
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
      disabled={disabled}
      isSending={isProcessing}
      isCompressing={isCompressing}
      supportsVision={supportsVision}
      tokenUsage={{ usedTokens, maxTokens }}
      className="mx-3 mb-4"
      dataTour="ai-panel-input"
    />
  )
}
