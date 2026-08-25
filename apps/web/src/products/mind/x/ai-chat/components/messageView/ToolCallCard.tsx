/** Unified rows for built-in and dynamic tool calls. */

import React, { useEffect, useMemo, useState } from "react"
import {
  Check,
  Circle,
  Code,
  Frame,
  FileText,
  Globe,
  Image,
  Loader2,
  MessageSquare,
  PenLine,
  Search,
  TriangleAlert,
} from "lucide-react"
import { getToolLabel } from "../../../ai-chat/agent-tools"
import { useTranslation } from "@zoeymind/i18n"
import { countTokensInValue } from "../../../ai-chat/utils/tokenCounter"
import { TOOL_EXECUTION_INTERRUPTED } from "../../../ai-chat/utils/pendingToolCalls"
import { MCPToolCallCard } from "./MCPToolCallCard"
import { toolNameFromPart, type ToolCallPart } from "./tool-call-part"
import { ToolCallDetail, ToolCallRow, type ToolCallRowTone } from "./ToolCallRow"

const MAX_TOOL_DETAIL_CHARS = 4_000
const STREAM_STALLED_AFTER_MS = 3_000

interface BoundedDetail {
  text: string
  truncated: boolean
}

function boundedDetail(value: unknown): BoundedDetail {
  const text = typeof value === "string" ? value : JSON.stringify(value, null, 2)
  return text.length > MAX_TOOL_DETAIL_CHARS
    ? { text: text.slice(0, MAX_TOOL_DETAIL_CHARS), truncated: true }
    : { text, truncated: false }
}

function boundedStreamingInput(input: Record<string, unknown> | undefined): BoundedDetail | null {
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
  get_figma_metadata: Frame,
  get_figma_data: Frame,
  get_figma_image: Image,
}

interface ToolCallCardProps {
  part: ToolCallPart
}

const GenericToolCallCardImpl: React.FC<ToolCallCardProps> = ({ part }) => {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const toolName = toolNameFromPart(part)
  const inputStreaming = part.state === "input-streaming"
  const pending = inputStreaming || part.state === "input-available"
  const waitingUser = toolName === "question" && pending
  const failed = part.state === "output-error"
  const interrupted = failed && part.errorText === TOOL_EXECUTION_INTERRUPTED
  const complete = part.state === "output-available"
  const succeeded = complete && part.output?.success === true
  const outputFailed = complete && part.output?.success === false
  const streamingTokens = inputStreaming ? estimateStreamingTokens(part.input) : 0
  const streamStalled = useStreamingStalled(inputStreaming, streamingTokens)
  const tokenCount = useMemo(() => {
    if (pending) return 0
    let count = 0
    if (part.input && Object.keys(part.input).length > 0) count += countTokensInValue(part.input)
    if (part.output) count += countTokensInValue(part.output)
    return count
  }, [part.input, part.output, pending])
  const inputDetail = useMemo(
    () =>
      inputStreaming
        ? boundedStreamingInput(part.input)
        : part.input === undefined
          ? null
          : boundedDetail(part.input),
    [inputStreaming, part.input]
  )
  const outputDetail = useMemo(
    () => (part.output === undefined ? null : boundedDetail(part.output)),
    [part.output]
  )
  const expandable = part.input !== undefined || failed || complete
  const Icon = toolIcons[toolName]
  const tone: ToolCallRowTone = waitingUser
    ? "warning"
    : failed || outputFailed
      ? "destructive"
      : pending
        ? "active"
        : "default"
  const icon = pending ? (
    waitingUser ? (
      <MessageSquare className="size-3" />
    ) : (
      <Loader2 className="size-3 animate-spin" />
    )
  ) : failed || outputFailed ? (
    <TriangleAlert className="size-3" />
  ) : succeeded ? (
    <Check className="size-3 text-success" />
  ) : Icon ? (
    <Icon className="size-3" />
  ) : (
    <Circle className="size-2 fill-current" />
  )
  const status = waitingUser
    ? t("mindmap.aiChat.message.waitingFeedback")
    : inputStreaming
      ? t(
          streamStalled
            ? "mindmap.aiChat.message.toolStreamStalled"
            : "mindmap.aiChat.message.toolStreamGenerating"
        )
      : part.state === "input-available"
        ? t(
            toolName === "edit_current_mindmap"
              ? "mindmap.aiChat.message.applyingEdit"
              : "mindmap.aiChat.message.executingTool"
          )
        : interrupted
          ? t("mindmap.aiChat.message.aborted")
          : undefined
  const tokenText =
    inputStreaming && streamingTokens > 0
      ? `~${streamingTokens.toLocaleString()} tokens`
      : tokenCount > 0
        ? `~${tokenCount.toLocaleString()} tokens`
        : undefined

  return (
    <ToolCallRow
      open={open}
      onOpenChange={setOpen}
      expandable={expandable}
      icon={icon}
      title={getToolLabel(toolName) || toolName}
      status={status}
      trailing={
        tokenText ? (
          <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground/50">
            {tokenText}
          </span>
        ) : null
      }
      tone={tone}
      detail={
        <div className="max-h-[500px] space-y-1.5 overflow-y-auto border-l border-border/60 py-1 pl-2">
          {inputDetail ? (
            <ToolDetailBlock label={t("mindmap.aiChat.message.inputLabel")} value={inputDetail} />
          ) : null}
          {failed && part.errorText && !interrupted ? (
            <ToolCallDetail label={t("mindmap.aiChat.message.errorLabel")} tone="destructive">
              <div className="whitespace-pre-wrap text-[11px] text-destructive">
                {part.errorText}
              </div>
            </ToolCallDetail>
          ) : null}
          {outputDetail ? (
            <ToolDetailBlock label={t("mindmap.aiChat.message.outputLabel")} value={outputDetail} />
          ) : null}
        </div>
      }
    />
  )
}

function ToolDetailBlock({ label, value }: { label: string; value: BoundedDetail }) {
  return (
    <ToolCallDetail label={label}>
      <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-all font-mono text-[10px] leading-relaxed text-foreground/80">
        {value.text}
      </pre>
      {value.truncated ? (
        <div className="mt-1 text-[10px] text-muted-foreground">
          内容过长，仅显示前 {MAX_TOOL_DETAIL_CHARS.toLocaleString()} 个字符
        </div>
      ) : null}
    </ToolCallDetail>
  )
}

const ToolCallCardImpl: React.FC<ToolCallCardProps> = ({ part }) => {
  const toolName = toolNameFromPart(part)
  return toolName.startsWith("mcp_") ? (
    <MCPToolCallCard part={part} toolName={toolName} />
  ) : (
    <GenericToolCallCardImpl part={part} />
  )
}

function isSameSettledToolPart(prev: ToolCallCardProps, next: ToolCallCardProps): boolean {
  const a = prev.part
  const b = next.part
  if (a.state !== b.state || a.type !== b.type || a.toolCallId !== b.toolCallId) return false
  if (b.state === "output-available") return true
  if (b.state === "output-error") return a.errorText === b.errorText
  return false
}

export const ToolCallCard = React.memo(ToolCallCardImpl, isSameSettledToolPart)
