// @ts-nocheck — desktop mirror of cloud AI chat; runtime bridged via bridge.tsx
/**
 * ActionButtons - 输入框操作按钮组件
 */

import React, { useRef } from "react"
import { ArrowUp, Square, Plus, Loader2 } from "lucide-react"
import { cn } from "@/shared/app-shared"
import { useTranslation } from "@zoeymind/i18n"
import { Button, MetallicButton } from "@zoeymind/ui"

interface ActionButtonsProps {
  onSend: () => void
  onStop?: () => void
  onAddImage?: (files: File[]) => void
  disabled?: boolean
  isSending?: boolean
  isCompressing?: boolean
  hasContent: boolean
  supportsVision?: boolean
}

export const ActionButtons: React.FC<ActionButtonsProps> = ({
  onSend,
  onStop,
  onAddImage,
  disabled = false,
  isSending = false,
  isCompressing = false,
  hasContent,
  supportsVision = false,
}) => {
  const { t } = useTranslation()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length > 0 && onAddImage) {
      onAddImage(files)
      // 清空 input，允许重复选择相同文件
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    }
  }

  return (
    <div className="flex items-center justify-end gap-1">
      {/* 添加图片按钮：AI 处理中也可用 */}
      {supportsVision && onAddImage && (
        <>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleFileSelect}
            aria-label={t("mindmap.aiChat.input.addImage")}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled || isCompressing}
            className="size-7 rounded-full"
            aria-label={
              isCompressing
                ? t("mindmap.aiChat.input.compressingImage")
                : t("mindmap.aiChat.input.addImage")
            }
            title={
              isCompressing
                ? t("mindmap.aiChat.input.compressingImage")
                : t("mindmap.aiChat.input.addImage")
            }
          >
            {isCompressing ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <Plus className="size-4" />
            )}
          </Button>
        </>
      )}

      {/* 发送/停止按钮 */}
      {(() => {
        const showSend = hasContent && !disabled
        const showStop = isSending && !hasContent
        // 有内容 + AI 处理中 → "中断并发送"
        const isInterruptSend = showSend && isSending

        const isIdle = !showSend && !showStop
        const SendButton = isIdle ? MetallicButton : Button
        const label = showStop
          ? t("mindmap.aiChat.input.stopGeneration")
          : isInterruptSend
            ? t("mindmap.aiChat.input.interruptAndSend")
            : t("mindmap.aiChat.input.sendMessage")

        return (
          <SendButton
            type="button"
            variant="ghost"
            size="icon-xs"
            metalScale={0.5}
            onClick={showStop ? onStop : onSend}
            disabled={!showSend && !showStop}
            className={cn(
              "size-6 rounded-full shadow-sm",
              showStop
                ? "bg-muted-foreground text-background hover:bg-muted-foreground/80"
                : isInterruptSend
                  ? "bg-warning text-white hover:bg-warning/90"
                  : showSend
                    ? "bg-primary text-primary-foreground hover:bg-primary/90"
                    : "text-foreground"
            )}
            aria-label={label}
            title={label}
          >
            {showStop ? (
              <Square className="size-3 fill-current" />
            ) : isInterruptSend ? (
              <ArrowUp className="size-4" />
            ) : (
              <ArrowUp className="size-4" />
            )}
          </SendButton>
        )
      })()}
    </div>
  )
}
