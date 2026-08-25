/** Expandable AI error summary. */

import React, { useState } from "react"
import { AlertCircle, ChevronDown, RefreshCcw } from "lucide-react"
import { useTranslation } from "@zoeymind/i18n"
import { Button, Collapsible, CollapsibleContent, CollapsibleTrigger, cn } from "@zoeymind/ui"
import { useAIChatV2Store } from "../../../ai-chat/stores/useAIChatV2Store"
import type { ChatErrorDetails } from "../../../ai-chat/utils/errorHandler"

interface ErrorCardProps {
  error: ChatErrorDetails
  isLast?: boolean
}

export const ErrorCard: React.FC<ErrorCardProps> = ({ error, isLast = false }) => {
  const { t } = useTranslation()
  const [isExpanded, setIsExpanded] = useState(true)
  const lastSentInput = useAIChatV2Store(s => s.lastSentInput)
  const isQuota = error.code === "INSUFFICIENT_QUOTA"
  const isOverflow = error.code === "CONTEXT_OVERFLOW"
  const translationKey = isQuota
    ? "insufficientQuota"
    : isOverflow
      ? "contextOverflow"
      : "requestFailed"
  const title = t(`mindmap.aiChat.error.${translationKey}.title`)
  const body = error.message ?? t(`mindmap.aiChat.error.${translationKey}.body`)

  const handleRestoreInput = () => {
    const store = useAIChatV2Store.getState()
    if (store.lastSentInput) store.restoreInput()
  }

  return (
    <Collapsible open={isExpanded} onOpenChange={setIsExpanded} className="w-full max-w-full">
      <CollapsibleTrigger className="flex w-full items-center gap-1.5 rounded-sm py-0.5 text-left transition-colors hover:bg-muted/40">
        <span className="size-1.5 shrink-0 rounded-full bg-destructive" />
        <AlertCircle className="size-3 shrink-0 text-destructive" />
        <span className="truncate text-xs text-destructive">{title}</span>
        <ChevronDown
          className={cn(
            "ml-auto size-3 shrink-0 text-muted-foreground/40 transition-transform",
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
              onClick={handleRestoreInput}
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
