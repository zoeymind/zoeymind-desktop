/**
 * MessageComposerBox - AI 对话消息组合框（唯一组件，两种状态）。
 *
 * 同一个组件既是底部输入框，也是已发送的用户消息：附件预览 + 可 @mention 的
 * 输入框 + 底部工具栏（模型选择 / 发送 / 加图）。用户消息只是它的“收起态”，
 * 点击后原地展开底部工具栏并允许编辑，DOM 与编辑器实例始终是同一个，不替换。
 *
 * - expanded=true（默认，底部输入框）：编辑器可编辑，工具栏常驻。
 * - expanded=false（已发送的用户消息收起态）：编辑器只读，工具栏用 motion 收起。
 */

import React from "react"
import { AnimatePresence, motion } from "motion/react"
import { cn } from "@/shared/app-shared"
import { InputBox } from "./InputBox"
import { MediaPreview } from "./MediaPreview"
import { ComposerToolbar } from "./ComposerToolbar"
import type { AIModel } from "../../../ai-chat/hooks/useModelSelector"
import type { Attachment } from "../../../ai-chat/types"
import type { MessageTokenUsage } from "../../../ai-chat/utils/messageTokenUsage"

interface MessageComposerBoxProps {
  value: string
  onChange: (value: string) => void
  onKeyDown: (event: React.KeyboardEvent) => void
  attachments: Attachment[]
  onRemoveAttachment: (index: number) => void
  models: AIModel[]
  selectedModel: string
  setSelectedModel: (modelId: string) => void
  onSend: () => void
  onStop?: () => void
  onAddImage?: (files: File[]) => void
  /** 是否展开工具栏并允许编辑。默认 true（底部输入框）。false 时为已发送用户消息的收起只读态 */
  expanded?: boolean
  disabled?: boolean
  isSending?: boolean
  isCompressing?: boolean
  supportsVision?: boolean
  tokenUsage?: MessageTokenUsage
  placeholder?: string
  className?: string
  dataTour?: string
}

export const MessageComposerBox: React.FC<MessageComposerBoxProps> = ({
  value,
  onChange,
  onKeyDown,
  attachments,
  onRemoveAttachment,
  models,
  selectedModel,
  setSelectedModel,
  onSend,
  onStop,
  onAddImage,
  expanded = true,
  disabled = false,
  isSending = false,
  isCompressing = false,
  supportsVision = false,
  tokenUsage,
  placeholder,
  className,
  dataTour,
}) => {
  const hasContent = value.trim().length > 0 || attachments.length > 0
  // 收起态：编辑器只读、附件不可删、工具栏不可用
  const isReadonly = disabled || !expanded

  return (
    <div
      className={cn(
        "relative rounded-xl border border-border bg-muted/50 shadow-sm transition-colors duration-100 ease-out motion-reduce:transition-none",
        "p-2",
        className
      )}
      data-tour={dataTour}
    >
      <div className="flex flex-col">
        {attachments.length > 0 && (
          <div className="mb-2 px-1">
            <MediaPreview
              attachments={attachments}
              onRemove={onRemoveAttachment}
              disabled={isReadonly}
            />
          </div>
        )}

        <InputBox
          value={value}
          onChange={onChange}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          disabled={isReadonly}
          onPasteMedia={supportsVision ? onAddImage : undefined}
        />

        {/* 工具栏模块：仅展开态出现，收起 ↔ 展开做快速高度动画（模型下拉走 Portal 不受裁剪） */}
        <AnimatePresence initial={false}>
          {expanded && (
            <motion.div
              key="toolbar"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.12, ease: "easeOut" }}
              className="overflow-hidden"
            >
              <ComposerToolbar
                models={models}
                selectedModel={selectedModel}
                setSelectedModel={setSelectedModel}
                onSend={onSend}
                onStop={onStop}
                onAddImage={onAddImage}
                disabled={disabled}
                isSending={isSending}
                isCompressing={isCompressing}
                hasContent={hasContent}
                supportsVision={supportsVision}
                tokenUsage={tokenUsage}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
