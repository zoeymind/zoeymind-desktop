// @ts-nocheck — desktop mirror of cloud AI chat; runtime bridged via bridge.tsx
/**
 * Composer actions — attachment lives beside the model selector; send stays right-aligned.
 */

import React, { useRef } from "react"
import { ArrowUp, Square, Plus, Loader2 } from "lucide-react"
import { cn } from "@/shared/app-shared"
import { useTranslation } from "@zoeymind/i18n"
import { Button, MetallicButton } from "@zoeymind/ui"

interface AttachmentButtonProps {
  onAddImage?: (files: File[]) => void
  disabled?: boolean
  isCompressing?: boolean
  supportsVision?: boolean
}

export const AttachmentButton: React.FC<AttachmentButtonProps> = ({
  onAddImage,
  disabled = false,
  isCompressing = false,
  supportsVision = false,
}) => {
  const { t } = useTranslation()
  const fileInputRef = useRef<HTMLInputElement>(null)

  if (!supportsVision || !onAddImage) return null

  const label = isCompressing
    ? t("mindmap.aiChat.input.compressingImage")
    : t("mindmap.aiChat.input.addImage")

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={event => {
          const files = Array.from(event.target.files || [])
          if (files.length > 0) onAddImage(files)
          event.target.value = ""
        }}
        aria-label={t("mindmap.aiChat.input.addImage")}
      />
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={() => fileInputRef.current?.click()}
        disabled={disabled || isCompressing}
        className="size-7 rounded-full"
        aria-label={label}
        title={label}
      >
        {isCompressing ? <Loader2 className="size-3 animate-spin" /> : <Plus className="size-4" />}
      </Button>
    </>
  )
}

interface ActionButtonsProps {
  onSend: () => void
  onStop?: () => void
  disabled?: boolean
  isSending?: boolean
  hasContent: boolean
}

export const ActionButtons: React.FC<ActionButtonsProps> = ({
  onSend,
  onStop,
  disabled = false,
  isSending = false,
  hasContent,
}) => {
  const { t } = useTranslation()
  const showSend = hasContent && !disabled
  const showStop = isSending && !hasContent
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
        "size-[23px] rounded-full shadow-sm",
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
      {showStop ? <Square className="size-3 fill-current" /> : <ArrowUp className="size-4" />}
    </SendButton>
  )
}
