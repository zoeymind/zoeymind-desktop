/**
 * AssistantMessage - 助手消息组件
 */

import React, { useMemo, useCallback, useState } from "react"
import type { UIMessage } from "@ai-sdk/react"
import { ChatMarkdown } from "./ChatMarkdown"
import { useAIChatV2Store } from "../../../ai-chat/stores/useAIChatV2Store"
import { ToolCallCard } from "./ToolCallCard"
import { ThinkingIndicator } from "./ThinkingIndicator"
import { ErrorCard } from "./ErrorCard"
import { parseChatError } from "../../../ai-chat/utils/errorHandler"
import { CollapsibleSteps } from "./CollapsibleSteps"
import { CompactSummaryCard } from "./CompactSummaryCard"
import { FileText, FolderOpen, Ban } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@zoeymind/ui"
import { Spinner } from "@zoeymind/ui"
import { useTranslation } from "@zoeymind/i18n"
import type {
  RetrieverResource,
  GenericMessagePart,
  UIMessageWithMetadata,
} from "../../../ai-chat/types"
import type { AIModel } from "../../../ai-chat/hooks/useModelSelector"
import { resolveModelDisplayName } from "../../../ai-chat/utils/modelDisplayName"
import { formatElapsedMs } from "../../../ai-chat/utils/duration"
import { isToolCallPart, type ToolCallPart } from "./tool-call-part"

interface ReasoningPart {
  type: "reasoning"
  text: string
}

function isReasoningPart(part: unknown): part is ReasoningPart {
  if (typeof part !== "object" || part === null) return false
  const p = part as { type?: unknown; text?: unknown }
  return p.type === "reasoning" && typeof p.text === "string"
}

interface AssistantMessageProps {
  message: UIMessage
  isLast?: boolean
  models: AIModel[]
  isProcessing?: boolean
}

const AssistantMessageImpl: React.FC<AssistantMessageProps> = ({
  message,
  models,
  isLast = false,
  isProcessing = false,
}) => {
  const { t } = useTranslation()
  const abortedMessageId = useAIChatV2Store(s => s.abortedMessageId)
  const isAborted = abortedMessageId === message.id
  const [selectedResource, setSelectedResource] = useState<RetrieverResource | null>(null)

  // ---- 分离 parts ----
  type IndexedToolPart = { part: ToolCallPart; index: number }
  type IndexedTextPart = { part: GenericMessagePart; index: number }
  type IndexedReasoningPart = { part: ReasoningPart; index: number }

  interface SeparatedParts {
    toolParts: IndexedToolPart[]
    textParts: IndexedTextPart[]
    reasoningParts: IndexedReasoningPart[]
    errorParts: IndexedTextPart[]
  }

  const { toolParts, textParts, reasoningParts, errorParts } = useMemo((): SeparatedParts => {
    const tools: IndexedToolPart[] = []
    const texts: IndexedTextPart[] = []
    const reasonings: IndexedReasoningPart[] = []
    const errors: IndexedTextPart[] = []

    if (!message.parts)
      return {
        toolParts: tools,
        textParts: texts,
        reasoningParts: reasonings,
        errorParts: errors,
      }

    message.parts.forEach((part, index) => {
      const genericPart = part as GenericMessagePart
      const isToolType = isToolCallPart(part)

      if (!isToolType && (genericPart.type === "error" || genericPart.errorText)) {
        errors.push({ part: genericPart, index })
      } else if (isReasoningPart(part)) {
        if (part.text.trim()) {
          reasonings.push({ part, index })
        }
      } else if (part.type === "text") {
        const textContent = typeof part.text === "string" ? part.text : String(part.text || "")
        if (textContent.trim()) {
          texts.push({ part: genericPart, index })
        }
      } else if (isToolCallPart(part)) {
        tools.push({ part, index })
      }
    })

    return {
      toolParts: tools,
      textParts: texts,
      reasoningParts: reasonings,
      errorParts: errors,
    }
  }, [message.parts])

  const useCollapsible = toolParts.length >= 2

  const hasTextContent = textParts.length > 0
  const hasToolContent = toolParts.length > 0
  const hasReasoningContent = reasoningParts.length > 0
  const hasErrorContent = errorParts.length > 0

  const messageMetadata = useMemo(() => (message as UIMessageWithMetadata).metadata, [message])

  const retrieverResources = useMemo(
    (): RetrieverResource[] => messageMetadata?.retriever_resources || [],
    [messageMetadata]
  )

  const messageMeta = useMemo(() => {
    if (!messageMetadata) return null
    const { modelId, totalUsage, turnDurationMs } = messageMetadata
    const tokens = totalUsage ? (totalUsage.inputTokens ?? 0) + (totalUsage.outputTokens ?? 0) : 0
    const duration = formatElapsedMs(turnDurationMs)
    if (!modelId && tokens <= 0 && !duration) return null
    return { modelId, tokens: tokens > 0 ? tokens : undefined, duration }
  }, [messageMetadata])
  const modelName = resolveModelDisplayName(messageMeta?.modelId, models)

  const renderTextPart = useCallback(
    (part: GenericMessagePart, key: number | string, isStreaming = false) => {
      const textContent = typeof part.text === "string" ? part.text : String(part.text || "")
      if (!textContent.trim()) return null
      return (
        <div key={key}>
          <ChatMarkdown content={textContent} isStreaming={isStreaming} />
        </div>
      )
    },
    []
  )

  const lastActivePartIndex = useMemo(() => {
    if (!message.parts) return -1
    for (let i = message.parts.length - 1; i >= 0; i--) {
      const part = message.parts[i]
      const genericPart = part as GenericMessagePart
      const isToolType = isToolCallPart(part)
      if (!isToolType && (genericPart.type === "error" || genericPart.errorText)) return i
      if (part.type === "text") {
        const text = typeof part.text === "string" ? part.text : String(part.text || "")
        if (text.trim()) return i
      }
      if (isReasoningPart(part) && part.text.trim()) return i
      if (isToolType) return i
    }
    return -1
  }, [message.parts])

  const renderPart = useCallback(
    (part: unknown, partIndex: number, isLastActive = false) => {
      const genericPart = part as GenericMessagePart
      const isToolType = isToolCallPart(part)
      const isError = !isToolType && (genericPart.type === "error" || genericPart.errorText)

      if (isError) {
        const raw = genericPart.errorText || genericPart.error || ""
        return <ErrorCard key={`error-${partIndex}`} error={parseChatError(raw)} isLast={isLast} />
      }

      if (isReasoningPart(part)) {
        if (!part.text.trim()) return null
        const isStreamingReasoning =
          isProcessing && isLast && partIndex === (message.parts?.length ?? 0) - 1
        return (
          <ThinkingIndicator
            key={`r-${partIndex}`}
            text={part.text}
            isStreaming={isStreamingReasoning}
          />
        )
      }
      if (genericPart.type === "text") {
        const isStreamingText = isProcessing && isLast && partIndex === lastActivePartIndex
        return renderTextPart(
          genericPart,
          isLastActive ? `last-${partIndex}` : partIndex,
          isStreamingText
        )
      }
      if (isToolCallPart(part)) {
        return <ToolCallCard key={partIndex} part={part} />
      }
      return null
    },
    [isProcessing, isLast, lastActivePartIndex, message.parts, renderTextPart]
  )

  // 压缩摘要消息: 单独渲染成一个紧凑卡片, 不走正常的 message 渲染
  const compactMeta = (
    message as UIMessageWithMetadata & {
      metadata?: { isCompactSummary?: boolean; compactedCount?: number; modelId?: string }
    }
  ).metadata
  if (compactMeta?.isCompactSummary) {
    return (
      <CompactSummaryCard
        text={textParts[0]?.part?.text || ""}
        compactedCount={compactMeta.compactedCount}
        modelId={compactMeta.modelId}
      />
    )
  }

  // 空 / 中止状态判定 (官方语义, docs/research/ai-sdk-chat-streaming.md §4.4):
  // 空响应只可能在流结束后成立. 流式途中 parts 为空 (或只有空 text part 瞬态) 属正常,
  // 由 MessageView 的等待 spinner 负责显示 (同一谓词 hasRenderableContent 保证判定一致),
  // 这里 return null 不重复渲染.
  const isReallyEmpty =
    !hasTextContent && !hasToolContent && !hasReasoningContent && !hasErrorContent
  if (isReallyEmpty) {
    if (isProcessing && isLast) {
      return null
    }
    if (isAborted) {
      return (
        <div className="relative group flex flex-col items-start">
          <div className="flex items-center gap-1.5 py-1 text-xs text-muted-foreground/50">
            <Ban className="size-3" />
            <span>{t("mindmap.aiChat.message.abortedGeneration")}</span>
          </div>
        </div>
      )
    }
    return (
      <div className="relative group flex flex-col items-start">
        <div className="flex items-center gap-1.5 py-1 text-xs text-destructive/60">
          <span className="size-1.5 rounded-full bg-destructive flex-shrink-0" />
          <span>{t("mindmap.aiChat.message.emptyResponse")}</span>
        </div>
      </div>
    )
  }

  return (
    <div className="relative group flex flex-col items-start">
      <div className="flex flex-col p-2 rounded-lg w-full max-w-full break-words overflow-hidden">
        <div className="text-xs">
          {useCollapsible ? (
            <CollapsibleSteps
              toolParts={toolParts}
              isProcessing={isProcessing && isLast}
              allParts={message.parts || []}
              lastActivePartIndex={lastActivePartIndex}
              turnStartedAt={messageMetadata?.turnStartedAt}
              turnDurationMs={messageMetadata?.turnDurationMs}
              renderPart={renderPart}
            />
          ) : (
            <>{(message.parts || []).map((part, partIndex) => renderPart(part, partIndex))}</>
          )}
        </div>

        {isProcessing && isLast && (
          <div className="mt-2 pl-2">
            <Spinner variant="ellipsis" size={16} className="text-foreground" />
          </div>
        )}

        {!isProcessing && (isAborted || messageMeta) && (
          <div className="mt-1 flex items-center gap-1.5 text-[10px] text-muted-foreground/40 select-none">
            {isAborted && (
              <>
                <Ban className="size-2.5" />
                <span>{t("mindmap.aiChat.message.aborted")}</span>
                {messageMeta && <span>·</span>}
              </>
            )}
            {modelName && <span>{modelName}</span>}
            {modelName && messageMeta?.tokens && <span>·</span>}
            {messageMeta?.tokens && <span>{messageMeta.tokens.toLocaleString()} tokens</span>}
            {messageMeta?.duration && (
              <span className="ml-auto tabular-nums">{messageMeta.duration}</span>
            )}
          </div>
        )}

        {retrieverResources.length > 0 && (
          <div className="mt-2 pt-2 border-t border-border">
            <div className="flex items-center gap-1.5 flex-wrap text-[10px] text-muted-foreground">
              <span className="font-medium">{t("mindmap.aiChat.message.referenceSources")}</span>
              {retrieverResources.map((resource: RetrieverResource) => {
                return (
                  <div
                    key={resource.chunk_id || resource.position}
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-muted/50 transition-colors cursor-pointer"
                    onClick={() => setSelectedResource(resource)}
                  >
                    {resource.data_source_type === "feishu_document" ? (
                      <FileText className="size-2.5 text-primary flex-shrink-0" />
                    ) : (
                      <FolderOpen className="size-2.5 text-primary flex-shrink-0" />
                    )}
                    <span className="text-muted-foreground truncate max-w-[120px]">
                      {resource.document_name}
                      {resource.block_id && (
                        <span className="text-muted-foreground/70 ml-0.5">
                          #{resource.block_id.substring(0, 4)}
                        </span>
                      )}
                    </span>
                    {resource.score && (
                      <span className="text-muted-foreground/70">
                        {(resource.score * 100).toFixed(0)}%
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {selectedResource && (
        <Dialog open={!!selectedResource} onOpenChange={open => !open && setSelectedResource(null)}>
          <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {selectedResource.data_source_type === "feishu_document" ? (
                  <FileText className="size-4 text-primary" />
                ) : (
                  <FolderOpen className="size-4 text-primary" />
                )}
                {selectedResource.document_name}
              </DialogTitle>
              {selectedResource.data_source_name &&
                selectedResource.data_source_name !== selectedResource.document_name && (
                  <DialogDescription>{selectedResource.data_source_name}</DialogDescription>
                )}
            </DialogHeader>
            <div className="space-y-4 mt-4">
              {selectedResource.block_id && (
                <div className="text-sm text-muted-foreground">
                  <span className="font-medium">{t("mindmap.aiChat.message.paragraphId")}</span>
                  <span className="font-mono text-xs">{selectedResource.block_id}</span>
                </div>
              )}
              {selectedResource.score && (
                <div className="text-sm text-muted-foreground">
                  <span className="font-medium">{t("mindmap.aiChat.message.relevance")}</span>
                  <span>{(selectedResource.score * 100).toFixed(1)}%</span>
                </div>
              )}
              {selectedResource.content && (
                <div className="mt-4 pt-4 border-t border-border">
                  <div className="text-sm font-medium text-foreground mb-2">
                    {t("mindmap.aiChat.message.contentSnippet")}
                  </div>
                  <div className="text-sm text-muted-foreground whitespace-pre-wrap bg-muted/50 p-3 rounded max-h-96 overflow-y-auto">
                    {selectedResource.content}
                  </div>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

// 流式期间 AI SDK 每 token 重建 messages 数组引用, MessageView 会重渲染全部可见消息.
// 已定稿消息 message 对象引用稳定, memo 后每 token 仅重渲染正在流式的最后一条,
// 避免旧消息的 markdown/工具卡片/motion 反复重算.
export const AssistantMessage = React.memo(AssistantMessageImpl)
