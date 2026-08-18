// @ts-nocheck — dormant AI chat / MCP module (bridge.tsx flattens to no-op)
/**
 * ActionButtons - 输入框操作按钮组件
 */

import React, { useRef } from 'react'
import { SendIcon, Square, Image as ImageIcon, MessageSquare, Loader2 } from 'lucide-react'
import { cn } from '@/shared/app-shared'
import { useTranslation } from '@zoeymind/i18n'

interface ActionButtonsProps {
  onSend: () => void
  onStop?: () => void
  onAddImage?: (files: File[]) => void
  onOpenPromptSettings?: () => void
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
  onOpenPromptSettings,
  disabled = false,
  isSending = false,
  isCompressing = false,
  hasContent,
  supportsVision = false
}) => {
  const { t } = useTranslation()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length > 0 && onAddImage) {
      onAddImage(files)
      // 清空 input，允许重复选择相同文件
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  return (
    <div className="flex items-center justify-end gap-1">
      {/* 自定义指令按钮：AI 处理中也可用 */}
      {onOpenPromptSettings && (
        <button
          type="button"
          onClick={onOpenPromptSettings}
          disabled={disabled}
          className={cn(
            'flex size-6 items-center justify-center rounded-md',
            'text-muted-foreground transition-all hover:bg-muted hover:text-foreground active:scale-95',
            disabled && 'opacity-50 cursor-not-allowed'
          )}
          aria-label={t('mindmap.aiChat.input.customInstruction')}
          title={t('mindmap.aiChat.input.customInstruction')}
        >
          <MessageSquare className="size-3" />
        </button>
      )}

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
            aria-label={t('mindmap.aiChat.input.addImage')}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled || isCompressing}
            className={cn(
              'flex size-6 items-center justify-center rounded-md',
              'text-muted-foreground transition-all hover:bg-muted hover:text-foreground active:scale-95',
              (disabled || isCompressing) && 'opacity-50 cursor-not-allowed'
            )}
            aria-label={
              isCompressing
                ? t('mindmap.aiChat.input.compressingImage')
                : t('mindmap.aiChat.input.addImage')
            }
            title={
              isCompressing
                ? t('mindmap.aiChat.input.compressingImage')
                : t('mindmap.aiChat.input.addImage')
            }
          >
            {isCompressing ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <ImageIcon className="size-3" />
            )}
          </button>
        </>
      )}

      {/* 发送/停止按钮 */}
      {(() => {
        const showSend = hasContent && !disabled
        const showStop = isSending && !hasContent
        // 有内容 + AI 处理中 → "中断并发送"
        const isInterruptSend = showSend && isSending

        const label = showStop
          ? t('mindmap.aiChat.input.stopGeneration')
          : isInterruptSend
            ? t('mindmap.aiChat.input.interruptAndSend')
            : t('mindmap.aiChat.input.sendMessage')

        return (
          <button
            type="button"
            onClick={showStop ? onStop : onSend}
            disabled={!showSend && !showStop}
            className={cn(
              'flex size-6 items-center justify-center rounded-md transition-all',
              showStop
                ? 'bg-muted-foreground text-background hover:bg-muted-foreground/80 active:scale-95'
                : isInterruptSend
                  ? 'bg-warning text-white hover:bg-warning/90 active:scale-95'
                  : showSend
                    ? 'bg-primary text-primary-foreground hover:bg-primary/90 active:scale-95'
                    : 'text-muted-foreground/40 cursor-not-allowed'
            )}
            aria-label={label}
            title={label}
          >
            {showStop ? (
              <Square className="size-3 fill-current" />
            ) : isInterruptSend ? (
              <SendIcon className="size-3" />
            ) : (
              <SendIcon className="size-3" />
            )}
          </button>
        )
      })()}
    </div>
  )
}