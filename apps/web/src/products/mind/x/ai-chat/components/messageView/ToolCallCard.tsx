/** Generic card for built-in and external tool calls. */

import React, { useMemo, useState } from "react"
import {
  ChevronDown,
  Loader2,
  Search,
  FileText,
  PenLine,
  MessageSquare,
  Globe,
  Code,
  Figma,
  Image,
} from "lucide-react"
import { AnimatePresence, motion } from "motion/react"
import { cn } from "@/shared/app-shared"
import { getToolLabel } from "../../../ai-chat/agent-tools"
import { useTranslation } from "@zoeymind/i18n"

import { countTokensInValue } from "../../../ai-chat/utils/tokenCounter"

type ToolOutput = Record<string, unknown>

/**
 * 工具图标映射
 * 不同工具对应不同的图标，体现工具功能
 */
const toolIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  search: Search,
  read: FileText,
  edit: PenLine,
  question: MessageSquare,
  web_search: Search,
  web_fetch: Globe,
  read_feishu_document: MessageSquare,
  search_feishu_documents: Search,
  query_knowledge_bases: Code,
  get_figma_metadata: Figma,
  get_figma_data: Figma,
  get_figma_image: Image,
}

export interface ToolCallPart {
  type: string
  toolCallId?: string
  input?: Record<string, unknown>
  output?: ToolOutput
  state?: "input-streaming" | "input-available" | "output-available" | "output-error"
  errorText?: string
}

interface ToolCallCardProps {
  part: ToolCallPart
}

export const ToolCallCard: React.FC<ToolCallCardProps> = ({ part }) => {
  const { t } = useTranslation()
  const [isExpanded, setIsExpanded] = useState(false)
  const toolName = part.type.replace("tool-", "")
  const fullOutput = part.output

  const isAskUser = toolName === "question"
  const isPending = part.state === "input-streaming" || part.state === "input-available"
  const isWaitingUser = isAskUser && isPending
  const isFailed = part.state === "output-error"
  const isInterrupted =
    isFailed && part.errorText === t("mindmap.aiChat.message.executionInterrupted")
  const isComplete = part.state === "output-available"

  // 单个工具可能与同一模型响应中的其它工具并行产生，无法把网络和流式生成耗时
  // 诚实归属到某一个工具。整轮 wall-clock 由聚合卡和消息 footer 展示。

  // 判断执行结果（成功/失败）— 用精简的 part.output 判断状态即可
  const isSuccess = isComplete && part.output?.success === true
  const isOutputFailed = isComplete && part.output?.success === false
  const displayName = getToolLabel(toolName) || toolName

  const statusColor = isWaitingUser
    ? "bg-warning"
    : isPending
      ? "bg-primary/60"
      : isSuccess
        ? "bg-primary"
        : isInterrupted
          ? "bg-muted-foreground/40"
          : isOutputFailed || part.state === "output-error"
            ? "bg-destructive"
            : "bg-muted-foreground/30"

  const Icon = toolIcons[toolName]

  // Token 计数 (UI 显示用), 走 js-tiktoken o200k_base. input-streaming 阶段 SDK 只给 {}, 跳过.
  // 真实 token 走 streamText.finish.totalUsage, 那个在 metadata 里精确.
  const tokenCount = useMemo(() => {
    let n = 0
    if (part.input && typeof part.input === "object" && Object.keys(part.input).length > 0) {
      n += countTokensInValue(part.input)
    }
    if (part.output) n += countTokensInValue(part.output)
    return n
  }, [part.input, part.output])

  const hasExpandableContent = part.input !== undefined || isFailed || isComplete

  return (
    <div className="w-full max-w-full">
      {/* 头部行：状态点 + 工具名 + 耗时（参考 opencode 的单行 tool step 风格） */}
      <button
        type="button"
        aria-expanded={isExpanded}
        disabled={!hasExpandableContent}
        className={cn(
          "flex w-full items-center gap-1.5 rounded-sm py-0.5 text-left transition-colors",
          hasExpandableContent && "cursor-pointer hover:bg-muted/40",
          isExpanded && "bg-muted/30"
        )}
        onClick={() => setIsExpanded(expanded => !expanded)}
      >
        {/* 状态指示 */}
        {isPending && !isWaitingUser ? (
          <Loader2 className="size-3 animate-spin text-primary flex-shrink-0" />
        ) : isWaitingUser ? (
          <MessageSquare className="size-3 text-warning flex-shrink-0" />
        ) : (
          <div className={cn("size-1.5 rounded-full flex-shrink-0", statusColor)} />
        )}

        {/* 工具图标 */}
        {!isPending && !isWaitingUser && Icon && (
          <Icon className="size-3 text-muted-foreground flex-shrink-0" />
        )}

        {/* 工具名 */}
        <span
          className={cn(
            "text-xs truncate",
            isWaitingUser
              ? "text-warning dark:text-warning font-medium"
              : isPending
                ? "text-foreground font-medium"
                : "text-muted-foreground"
          )}
        >
          {displayName}
        </span>

        {/* 状态文字 */}
        {isWaitingUser && (
          <span className="text-[10px] text-warning">
            {t("mindmap.aiChat.message.waitingFeedback")}
          </span>
        )}
        {isPending && !isWaitingUser && (
          <span className="text-[10px] text-primary/70">
            {t("mindmap.aiChat.message.executing")}
          </span>
        )}
        {isInterrupted && (
          <span className="text-[10px] text-muted-foreground/50">
            {t("mindmap.aiChat.message.aborted")}
          </span>
        )}

        {/* 实时 token 计数 */}
        {tokenCount > 0 && (
          <span
            className={cn(
              "text-[10px] tabular-nums flex-shrink-0",
              isPending ? "text-primary/60" : "text-muted-foreground/40"
            )}
          >
            ~{tokenCount.toLocaleString()} tokens
          </span>
        )}

        <div className="flex-1" />

        {/* 展开箭头 */}
        {hasExpandableContent && (
          <ChevronDown
            className={cn(
              "size-3 text-muted-foreground/40 transition-transform flex-shrink-0",
              isExpanded && "rotate-180"
            )}
          />
        )}
      </button>

      {/* 展开内容 */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <div className="ml-3 pl-2 border-l border-muted mt-0.5 max-h-[500px] overflow-y-auto space-y-2">
              {isPending && part.input !== undefined && (
                <div className="rounded-sm bg-muted p-2">
                  <div className="mb-1 text-[10px] font-medium text-muted-foreground">
                    {t("mindmap.aiChat.message.inputLabel")}
                  </div>
                  <div className="whitespace-pre-wrap break-all font-mono text-xs text-foreground">
                    {typeof part.input === "string"
                      ? part.input
                      : JSON.stringify(part.input, null, 2)}
                  </div>
                </div>
              )}
              {isFailed && part.errorText && (
                <div className="rounded-sm bg-destructive/10 p-2">
                  <div className="mb-1 text-[10px] font-medium text-destructive">
                    {t("mindmap.aiChat.message.errorLabel")}
                  </div>
                  <div className="whitespace-pre-wrap text-xs text-destructive">
                    {part.errorText}
                  </div>
                </div>
              )}

              {isComplete && fullOutput && (
                <div className="space-y-2">
                  {part.input && (
                    <div className="rounded-sm bg-muted p-2">
                      <div className="mb-1 text-[10px] font-medium text-muted-foreground">
                        {t("mindmap.aiChat.message.inputLabel")}
                      </div>
                      <div className="whitespace-pre-wrap font-mono text-xs text-foreground">
                        {JSON.stringify(part.input, null, 2)}
                      </div>
                    </div>
                  )}
                  <div className="rounded-sm bg-muted p-2">
                    <div className="mb-1 text-[10px] font-medium text-muted-foreground">
                      {t("mindmap.aiChat.message.outputLabel")}
                    </div>
                    <div className="whitespace-pre-wrap font-mono text-xs text-foreground">
                      {JSON.stringify(fullOutput, null, 2)}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
