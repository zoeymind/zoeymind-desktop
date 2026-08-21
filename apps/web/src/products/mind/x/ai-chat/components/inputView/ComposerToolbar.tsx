// @ts-nocheck — desktop mirror of cloud AI chat; runtime bridged via bridge.tsx
/**
 * ComposerToolbar - 消息组合框的底部工具栏模块（独立模块）。
 *
 * 左：附件 + 模型选择器；右：发送 / 停止。
 * 只负责工具栏内容与布局；收起 ↔ 展开的动画由外层（MessageComposerBox）用
 * AnimatePresence 包裹做高度动画，本组件不感知状态切换。
 */

import React from "react"
import { ModelSelector } from "./ModelSelector"
import { ActionButtons, AttachmentButton } from "./ActionButtons"
import type { AIModel } from "../../../ai-chat/hooks/useModelSelector"

interface ComposerToolbarProps {
  models: AIModel[]
  selectedModel: string
  setSelectedModel: (modelId: string) => void
  onSend: () => void
  onStop?: () => void
  onAddImage?: (files: File[]) => void
  disabled?: boolean
  isSending?: boolean
  isCompressing?: boolean
  hasContent?: boolean
  supportsVision?: boolean
}

export const ComposerToolbar: React.FC<ComposerToolbarProps> = ({
  models,
  selectedModel,
  setSelectedModel,
  onSend,
  onStop,
  onAddImage,
  disabled = false,
  isSending = false,
  isCompressing = false,
  hasContent = false,
  supportsVision = false,
}) => {
  return (
    <div className="flex items-center justify-between pt-1">
      <div className="flex items-center gap-1">
        <AttachmentButton
          onAddImage={supportsVision ? onAddImage : undefined}
          disabled={disabled}
          isCompressing={isCompressing}
          supportsVision={supportsVision}
        />
        <ModelSelector
          models={models}
          selectedModel={selectedModel}
          setSelectedModel={setSelectedModel}
          disabled={disabled}
        />
      </div>
      <ActionButtons
        onSend={onSend}
        onStop={onStop}
        disabled={disabled}
        isSending={isSending}
        hasContent={hasContent}
      />
    </div>
  )
}
