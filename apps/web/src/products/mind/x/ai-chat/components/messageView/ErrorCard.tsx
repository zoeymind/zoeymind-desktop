// @ts-nocheck — desktop mirror of cloud AI chat; runtime bridged via bridge.tsx
/**
 * ErrorCard - 错误信息展示卡片.
 *
 * 只渲染两种状态 (与后端约定的 code):
 *   - INSUFFICIENT_QUOTA: 额度不足 → 只展示文案 (无 CTA)
 *   - REQUEST_FAILED:     其它失败 → "重试" CTA (恢复输入回输入框)
 *
 * 故意不展示任何原始 message / responseBody / request id —— 避免泄露内部 AI 服务链路.
 * 真要排查问题, admin 看后端 logger.error 的完整记录.
 */

import React, { useState } from "react"
import { AlertCircle, ChevronDown, RefreshCcw } from "lucide-react"
import { useTranslation } from "@zoeymind/i18n"
import { Button, Collapsible, CollapsibleContent, CollapsibleTrigger, cn } from "@zoeymind/ui"
import { useAIChatV2Store } from "../../../ai-chat/stores/useAIChatV2Store"
import type { ChatErrorCode } from "../../../ai-chat/utils/errorHandler"

interface ErrorCardProps {
  code: ChatErrorCode
  isLast?: boolean
}

export const ErrorCard: React.FC<ErrorCardProps> = ({ code, isLast = false }) => {
  const { t } = useTranslation()
  const [isExpanded, setIsExpanded] = useState(true)
  const lastSentInput = useAIChatV2Store(s => s.lastSentInput)
  const isQuota = code === "INSUFFICIENT_QUOTA"
  const isOverflow = code === "CONTEXT_OVERFLOW"
  const translationKey = isQuota
    ? "insufficientQuota"
    : isOverflow
      ? "contextOverflow"
      : "requestFailed"
  const title = t(`mindmap.aiChat.error.${translationKey}.title`)
  const body = t(`mindmap.aiChat.error.${translationKey}.body`)

  const handleRetry = () => {
    const s = useAIChatV2Store.getState()
    if (s.lastSentInput) {
      s.restoreInput()
    }
  }

  return (
    <Collapsible open={isExpanded} onOpenChange={setIsExpanded} className="w-full max-w-full">
      <CollapsibleTrigger className="flex w-full items-center gap-1.5 rounded-sm py-0.5 text-left transition-colors hover:bg-muted/40">
        <span className="size-1.5 shrink-0 rounded-full bg-destructive" />
        <AlertCircle className="size-3 shrink-0 text-destructive" />
        <span className="truncate text-xs text-destructive">{title}</span>
        <span className="ml-auto text-[10px] text-destructive/60">
          {t("mindmap.aiChat.message.errorLabel")}
        </span>
        <ChevronDown
          className={cn(
            "size-3 shrink-0 text-muted-foreground/40 transition-transform",
            isExpanded && "rotate-180"
          )}
        />
      </CollapsibleTrigger>

      <CollapsibleContent className="overflow-hidden">
        <div className="ml-3 mt-0.5 border-l border-destructive/30 pl-2">
          <p className="py-1 text-[11px] text-destructive/80">{body}</p>
          {isLast && !isQuota && lastSentInput && (
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={handleRetry}
              className="mb-1 h-6 px-1.5 text-primary"
            >
              <RefreshCcw className="size-3" />
              {isOverflow
                ? t("mindmap.aiChat.error.contextOverflow.cta")
                : t("mindmap.aiChat.error.requestFailed.cta")}
            </Button>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
