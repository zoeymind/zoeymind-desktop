/**
 * CompactSummaryCard — 渲染"对话历史已自动压缩"那条消息.
 *
 * 默认折叠成一个紧凑卡片, 点击展开看完整摘要 markdown.
 */

import { useState } from "react"
import { ChevronDown, ChevronRight, Package } from "lucide-react"
import { useTranslation } from "@zoeymind/i18n"
import { cn } from "@/shared/app-shared"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

interface CompactSummaryCardProps {
  /** 完整摘要文本 (含 COMPACTION_HEADER 前缀 + 8 章节 markdown) */
  text: string
  /** 被压缩的消息条数 */
  compactedCount?: number
  /** 压缩用的模型 id, 给用户看 */
  modelId?: string
}

export function CompactSummaryCard({ text, compactedCount, modelId }: CompactSummaryCardProps) {
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState(false)

  // 剥离 COMPACTION_HEADER 前缀 (📦 [...] ), 卡片自带 banner, 不需要重复
  const body = text.replace(/^📦\s*\[[^\]]+\]\s*\n+/, "").trim()

  return (
    <div className="relative group flex flex-col items-start w-full">
      <div className="w-full max-w-full rounded-lg border border-border bg-muted/30">
        <button
          type="button"
          onClick={() => setExpanded(v => !v)}
          className="w-full flex items-center justify-between gap-2 px-3 py-2 text-xs text-left hover:bg-muted/50 transition-colors rounded-lg"
        >
          <div className="flex items-center gap-2 min-w-0">
            <Package className="size-3.5 flex-shrink-0 text-muted-foreground" />
            <span className="font-medium truncate">
              {t("mindmap.aiChat.compaction.bannerTitle")}
            </span>
            {compactedCount !== undefined && (
              <span className="text-muted-foreground flex-shrink-0">
                · {t("mindmap.aiChat.compaction.bannerCount", { count: compactedCount })}
              </span>
            )}
          </div>
          {expanded ? (
            <ChevronDown className="size-3.5 flex-shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="size-3.5 flex-shrink-0 text-muted-foreground" />
          )}
        </button>

        {expanded && (
          <div className="px-3 pb-3 border-t border-border/50">
            <div
              className={cn(
                "prose prose-sm max-w-none dark:prose-invert",
                "prose-headings:text-xs prose-headings:font-semibold prose-headings:mt-3 prose-headings:mb-1",
                "prose-p:text-xs prose-p:my-1",
                "prose-li:text-xs prose-li:my-0",
                "prose-strong:text-xs prose-code:text-[10px]"
              )}
            >
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{body}</ReactMarkdown>
            </div>
            {modelId && (
              <div className="mt-2 pt-2 border-t border-border/50 text-[10px] text-muted-foreground">
                {t("mindmap.aiChat.compaction.modelHint", { model: modelId })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
