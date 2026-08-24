/**
 * Composer actions — attachment lives beside the model selector; send stays right-aligned.
 */

import React, { useRef } from "react"
import { ArrowUp, Square, Plus, Loader2 } from "lucide-react"
import { cn } from "@/shared/app-shared"
import { useTranslation } from "@zoeymind/i18n"
import { Button, MetallicButton, useTheme } from "@zoeymind/ui"

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
        className="size-[27px] rounded-full"
        aria-label={label}
        title={label}
      >
        {isCompressing ? (
          <Loader2 className="size-[15px] animate-spin" />
        ) : (
          <Plus className="size-[15px]" />
        )}
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
  const { resolvedTheme } = useTheme()
  const showSend = hasContent && !disabled
  const showStop = isSending && !hasContent
  const isInterruptSend = showSend && isSending
  const isIdle = !showSend && !showStop
  const label = showStop
    ? t("mindmap.aiChat.input.stopGeneration")
    : isInterruptSend
      ? t("mindmap.aiChat.input.interruptAndSend")
      : t("mindmap.aiChat.input.sendMessage")

  const buttonContent = showStop ? (
    <Square className="size-[11px] fill-current" />
  ) : (
    <ArrowUp className="size-[15px]" />
  )
  const className = cn(
    "size-[23px] rounded-full border-0 shadow-sm",
    showStop
      ? "bg-secondary text-secondary-foreground hover:bg-secondary/80"
      : showSend
        ? "bg-primary text-primary-foreground hover:bg-primary/90"
        : "bg-muted text-muted-foreground"
  )

  return (
    <MetallicButton
      type="button"
      variant="ghost"
      size="icon-xs"
      metalTheme={resolvedTheme}
      metalScale={0.5}
      onClick={showStop ? onStop : onSend}
      disabled={isIdle}
      className={className}
      aria-label={label}
      title={label}
    >
      {buttonContent}
    </MetallicButton>
  )
}
