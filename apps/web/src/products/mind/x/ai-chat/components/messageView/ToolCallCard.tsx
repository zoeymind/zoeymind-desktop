/** Generic card for built-in and external tool calls. */

import React, { useEffect, useMemo, useState } from "react"
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
import { cn } from "@/shared/app-shared"
import { getToolLabel } from "../../../ai-chat/agent-tools"
import { useTranslation } from "@zoeymind/i18n"

import { countTokensInValue } from "../../../ai-chat/utils/tokenCounter"
import { TOOL_EXECUTION_INTERRUPTED } from "../../../ai-chat/utils/pendingToolCalls"

const MAX_TOOL_DETAIL_CHARS = 4_000

function boundedDetail(value: unknown): { text: string; truncated: boolean } {
  const text = typeof value === "string" ? value : JSON.stringify(value, null, 2)
  return text.length > MAX_TOOL_DETAIL_CHARS
    ? { text: text.slice(0, MAX_TOOL_DETAIL_CHARS), truncated: true }
    : { text, truncated: false }
}
function boundedStreamingInput(input: Record<string, unknown> | undefined) {
  if (!input) return null
  const patch = typeof input.patch === "string" ? input.patch : ""
  if (!patch) return boundedDetail(input)
  const truncated = patch.length > MAX_TOOL_DETAIL_CHARS
  return {
    text: JSON.stringify(
      { ...input, patch: truncated ? patch.slice(0, MAX_TOOL_DETAIL_CHARS) : patch },
      null,
      2
    ),
    truncated,
  }
}

const STREAM_STALLED_AFTER_MS = 3_000

function estimateStreamingTokens(input: Record<string, unknown> | undefined): number {
  if (!input) return 0
  const patch = typeof input.patch === "string" ? input.patch : ""
  return Math.ceil(patch.length / 2)
}

function useStreamingStalled(active: boolean, estimatedTokens: number) {
  const [stalled, setStalled] = useState(false)

  useEffect(() => {
    if (!active) return
    const progressTimer = window.setTimeout(() => setStalled(false), 0)
    const stalledTimer = window.setTimeout(() => setStalled(true), STREAM_STALLED_AFTER_MS)
    return () => {
      window.clearTimeout(progressTimer)
      window.clearTimeout(stalledTimer)
    }
  }, [active, estimatedTokens])

  return stalled
}
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

const ToolCallCardImpl: React.FC<ToolCallCardProps> = ({ part }) => {
  const { t } = useTranslation()
  const [isExpanded, setIsExpanded] = useState(false)
  const toolName = part.type.replace("tool-", "")

  const isInputStreaming = part.state === "input-streaming"
  const isAskUser = toolName === "question"
  const isPending = isInputStreaming || part.state === "input-available"
  const isWaitingUser = isAskUser && isPending
  const isFailed = part.state === "output-error"
  const isInterrupted = isFailed && part.errorText === TOOL_EXECUTION_INTERRUPTED
  const isComplete = part.state === "output-available"
  const streamingTokenEstimate = isInputStreaming ? estimateStreamingTokens(part.input) : 0
  const streamStalled = useStreamingStalled(isInputStreaming, streamingTokenEstimate)

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

  const tokenCount = useMemo(() => {
    if (isPending) return 0
    let n = 0
    if (part.input && typeof part.input === "object" && Object.keys(part.input).length > 0)
      n += countTokensInValue(part.input)
    if (part.output) n += countTokensInValue(part.output)
    return n
  }, [isPending, part.input, part.output])

  const inputDetail = useMemo(
    () =>
      isInputStreaming
        ? boundedStreamingInput(part.input)
        : part.input === undefined
          ? null
          : boundedDetail(part.input),
    [isInputStreaming, part.input]
  )
  const outputDetail = useMemo(
    () => (part.output === undefined ? null : boundedDetail(part.output)),
    [part.output]
  )
  const hasExpandableContent = part.input !== undefined || isFailed || isComplete
  return (
    <div className="w-full max-w-full">
      <button
        type="button"
        aria-expanded={hasExpandableContent ? isExpanded : false}
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
        {isInputStreaming && !isWaitingUser && (
          <span className="text-[10px] text-primary/70">
            {t(
              streamStalled
                ? "mindmap.aiChat.message.toolStreamStalled"
                : "mindmap.aiChat.message.toolStreamGenerating"
            )}
          </span>
        )}
        {part.state === "input-available" && !isWaitingUser && (
          <span className="text-[10px] text-primary/70">
            {t(
              toolName === "edit_current_mindmap"
                ? "mindmap.aiChat.message.applyingEdit"
                : "mindmap.aiChat.message.executingTool"
            )}
          </span>
        )}
        {isInputStreaming && streamingTokenEstimate > 0 && (
          <span className="text-[10px] tabular-nums flex-shrink-0 text-primary/60">
            ~{streamingTokenEstimate.toLocaleString()} tokens
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
      {isExpanded && hasExpandableContent && (
        <div className="ml-3 mt-0.5 max-h-[500px] space-y-2 overflow-y-auto border-l border-muted pl-2">
          {isPending && inputDetail && (
            <div className="rounded-sm bg-muted p-2">
              <div className="mb-1 text-[10px] font-medium text-muted-foreground">
                {t("mindmap.aiChat.message.inputLabel")}
              </div>
              <div className="whitespace-pre-wrap break-all font-mono text-xs text-foreground">
                {inputDetail.text}
              </div>
              {inputDetail.truncated && (
                <div className="mt-1 text-[10px] text-muted-foreground">
                  内容过长，仅显示前 {MAX_TOOL_DETAIL_CHARS.toLocaleString()} 个字符
                </div>
              )}
            </div>
          )}
          {isFailed && part.errorText && !isInterrupted && (
            <div className="rounded-sm bg-destructive/10 p-2">
              <div className="mb-1 text-[10px] font-medium text-destructive">
                {t("mindmap.aiChat.message.errorLabel")}
              </div>
              <div className="whitespace-pre-wrap text-xs text-destructive">{part.errorText}</div>
            </div>
          )}
          {isComplete && (
            <div className="space-y-2">
              {inputDetail && (
                <div className="rounded-sm bg-muted p-2">
                  <div className="mb-1 text-[10px] font-medium text-muted-foreground">
                    {t("mindmap.aiChat.message.inputLabel")}
                  </div>
                  <div className="whitespace-pre-wrap font-mono text-xs text-foreground">
                    {inputDetail.text}
                  </div>
                  {inputDetail.truncated && (
                    <div className="mt-1 text-[10px] text-muted-foreground">
                      内容过长，仅显示前 {MAX_TOOL_DETAIL_CHARS.toLocaleString()} 个字符
                    </div>
                  )}
                </div>
              )}
              {outputDetail && (
                <div className="rounded-sm bg-muted p-2">
                  <div className="mb-1 text-[10px] font-medium text-muted-foreground">
                    {t("mindmap.aiChat.message.outputLabel")}
                  </div>
                  <div className="whitespace-pre-wrap font-mono text-xs text-foreground">
                    {outputDetail.text}
                  </div>
                  {outputDetail.truncated && (
                    <div className="mt-1 text-[10px] text-muted-foreground">
                      内容过长，仅显示前 {MAX_TOOL_DETAIL_CHARS.toLocaleString()} 个字符
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * 流式期间 AI SDK 每 tick structuredClone 整条消息, 所有 part 引用全换新.
 * 已完成 (output-available / output-error) 的 tool part 内容不可变, 按
 * toolCallId + state 判等跳过重渲染 — 避免每 tick 对完整 tool payload
 * 重跑 tiktoken encode 和 JSON.stringify.
 */
function isSameSettledToolPart(prev: ToolCallCardProps, next: ToolCallCardProps): boolean {
  const a = prev.part
  const b = next.part
  if (a.state !== b.state || a.type !== b.type || a.toolCallId !== b.toolCallId) return false
  if (b.state === "output-available") return true
  if (b.state === "output-error") return a.errorText === b.errorText
  return false
}

export const ToolCallCard = React.memo(ToolCallCardImpl, isSameSettledToolPart)
