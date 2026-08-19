// @ts-nocheck — desktop mirror of cloud AI chat; runtime bridged via bridge.tsx
/**
 * AssistantMessage - 助手消息组件
 */

import React, { useMemo, useEffect, useCallback, useState } from 'react'
import type { UIMessage } from '@ai-sdk/react'
import ReactMarkdown from 'react-markdown'
import type { Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import { useMindMapInstance } from '../../../ai-chat/context/MindMapInstanceContext'
import { useAIChatV2Store } from '../../../ai-chat/stores/useAIChatV2Store'
import { SessionIdMapper } from '../../../ai-chat/tools/session-id-mapper'
import { getModuleAIChatRuntime } from '../../../ai-chat/context/AIChatRuntimeContext'
import { ToolCallCard, type ToolCallPart } from './ToolCallCard'
import { ThinkingIndicator } from './ThinkingIndicator'
import { ErrorCard } from './ErrorCard'
import { classifyChatError } from '../../../ai-chat/utils/errorHandler'
import { CollapsibleSteps } from './CollapsibleSteps'
import { CompactSummaryCard } from './CompactSummaryCard'
import { extractNodeIdFromClass } from '../../../ai-chat/utils/mentions'
import { processMentions, stripMentionsForCodeBlock } from '@/shared/app-shared'
import { INLINE_CODE_ZTDL_REGEX } from '../../../ai-chat/utils/ztdl-mention-regex'
import { cn } from '@/shared/app-shared'
import {
  FileText,
  FolderOpen,
  Minus,
  FolderClosed,
  ClipboardList,
  Ban,
  HelpCircle
} from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@zoeymind/ui'
import { Spinner } from '@zoeymind/ui'
import { CodeBlock } from '@/shared/app-shared'
import { useTranslation } from '@zoeymind/i18n'
import type {
  RetrieverResource,
  GenericMessagePart,
  UIMessageWithMetadata
} from '../../../ai-chat/types'

interface ReasoningPart {
  type: 'reasoning'
  text: string
}

function isReasoningPart(part: unknown): part is ReasoningPart {
  if (typeof part !== 'object' || part === null) return false
  const p = part as { type?: unknown; text?: unknown }
  return p.type === 'reasoning' && typeof p.text === 'string'
}

function isToolCallPart(part: unknown): part is ToolCallPart {
  if (typeof part !== 'object' || part === null) return false
  const p = part as { type?: unknown }
  return typeof p.type === 'string' && p.type.startsWith('tool-')
}
interface AssistantMessageProps {
  message: UIMessage
  isLast?: boolean
  isProcessing?: boolean
}

export const AssistantMessage: React.FC<AssistantMessageProps> = ({
  message,
  isLast = false,
  isProcessing = false
}) => {
  const { t } = useTranslation()
  const mindMap = useMindMapInstance()
  const abortedMessageId = useAIChatV2Store(s => s.abortedMessageId)
  const isAborted = abortedMessageId === message.id
  const [selectedResource, setSelectedResource] = useState<RetrieverResource | null>(null)
  const [dataVersion, setDataVersion] = useState(0)

  // 订阅 mindMap 数据变化, 触发 mention 渲染重算
  useEffect(() => {
    if (!mindMap) return
    const onDataChange = () => setDataVersion(v => v + 1)
    mindMap.on('data_change', onDataChange)
    mindMap.on('set_data', onDataChange)
    return () => {
      mindMap.off('data_change', onDataChange)
      mindMap.off('set_data', onDataChange)
    }
  }, [mindMap])

  type MindMapNode = {
    data?: {
      uid?: string
      text?: string
      icon?: string[]
    }
    children?: MindMapNode[]
  }

  const findNode = useCallback(
    (uid: string): MindMapNode | null => {
      const mm = mindMap
      if (!mm) return null
      try {
        const tree = (mm as { renderer?: { renderTree?: MindMapNode | null } }).renderer?.renderTree
        if (!tree) return null

        const walk = (node: MindMapNode | null): MindMapNode | null => {
          if (!node) return null
          if (node.data?.uid === uid) return node
          if (node.children) {
            for (const child of node.children) {
              const found = walk(child)
              if (found) return found
            }
          }
          return null
        }
        return walk(tree)
      } catch {
        return null
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mindMap, dataVersion]
  )

  // 删除了 resolveShortId，现在由 mentions-processor 内部处理

  const markdownComponents: Components = useMemo(
    () => ({
      p({ children }) {
        const content = Array.isArray(children) ? children.join('') : String(children || '')
        if (content.includes('<span class="mention-tag')) {
          return <p className="my-1" dangerouslySetInnerHTML={{ __html: content }} />
        }
        return <p className="my-1">{children}</p>
      },
      code({ className, children, ...props }) {
        const match = /language-(\w+)(?::(.+))?/.exec(className || '')
        const isInline = !match
        if (isInline) {
          let content = Array.isArray(children) ? children.join('') : String(children || '')
          // ✅ 解码 HTML 实体（无论是否有 mention）
          content = content.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
          // 检查是否包含多行内容
          const hasNewlines = content.includes('\n')
          return (
            <code
              className={cn(
                'rounded bg-muted px-1 py-0.5 font-mono text-[11px]',
                hasNewlines ? 'whitespace-pre block' : ''
              )}
              {...props}
            >
              {content}
            </code>
          )
        }
        const language = match?.[1] || 'text'
        const title = match?.[2]
        const contentRaw = Array.isArray(children) ? children.join('') : String(children || '')

        const content = stripMentionsForCodeBlock(contentRaw)
        return (
          <CodeBlock
            code={content.replace(/\n$/, '')}
            language={language}
            title={title}
            className="my-2"
          />
        )
      },
      pre({ children }) {
        return <>{children}</>
      },
      table({ children }) {
        return (
          <div className="my-2 overflow-x-auto">
            <table className="w-full border-collapse text-xs">{children}</table>
          </div>
        )
      },
      th({ children }) {
        const content = Array.isArray(children) ? children.join('') : String(children || '')
        if (content.includes('<span class="mention-tag')) {
          return (
            <th
              className="border border-muted px-2 py-1 text-left font-medium"
              dangerouslySetInnerHTML={{ __html: content }}
            />
          )
        }
        return <th className="border border-muted px-2 py-1 text-left font-medium">{children}</th>
      },
      td({ children }) {
        const content = Array.isArray(children) ? children.join('') : String(children || '')
        // ✅ 如果内容包含 HTML 标签（mention），使用 dangerouslySetInnerHTML
        if (content.includes('<span class="mention-tag')) {
          return (
            <td
              className="border border-muted px-2 py-1 align-top"
              dangerouslySetInnerHTML={{ __html: content }}
            />
          )
        }
        return <td className="border border-muted px-2 py-1 align-top">{children}</td>
      },
      ul({ children }) {
        return <ul className="my-1 list-disc pl-4 text-xs">{children}</ul>
      },
      ol({ children }) {
        return <ol className="my-1 list-decimal pl-4 text-xs">{children}</ol>
      },
      li({ children }) {
        const content = Array.isArray(children) ? children.join('') : String(children || '')
        if (content.includes('<span class="mention-tag')) {
          return <li className="text-xs" dangerouslySetInnerHTML={{ __html: content }} />
        }
        return <li className="text-xs">{children}</li>
      },
      blockquote({ children }) {
        return (
          <blockquote className="my-2 border-l-2 border-primary/40 bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            {children}
          </blockquote>
        )
      },
      a({ children, href }) {
        const safeHref = href || '#'
        return (
          <a
            href={safeHref}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:text-primary hover:underline"
          >
            {children}
          </a>
        )
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      span(props: any) {
        const { className = '', children } = props
        const nodeId = extractNodeIdFromClass(className)

        if (className.includes('mention-tag') && nodeId) {
          const isFound = className.includes('ztdl-found')
          const isModule = className.includes('ztdl-M')

          const getPriorityBadge = () => {
            if (isModule)
              return <FolderClosed className="size-3 inline-block text-muted-foreground" />
            const priorityConfig: Record<string, { label: string; bg: string }> = {
              'ztdl-p1': { label: '1', bg: 'bg-destructive' },
              'ztdl-p2': { label: '2', bg: 'bg-warning' },
              'ztdl-p3': { label: '3', bg: 'bg-muted' }
            }
            for (const [cls, config] of Object.entries(priorityConfig)) {
              if (className.includes(cls)) {
                return (
                  <span
                    className={`inline-flex size-3.5 items-center justify-center rounded-full ${config.bg} flex-shrink-0`}
                  >
                    <span className="text-[8px] font-semibold text-white">{config.label}</span>
                  </span>
                )
              }
            }
            return <ClipboardList className="size-3 inline-block text-muted-foreground" />
          }

          if (isFound) {
            return (
              <span
                className="inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-xs text-primary cursor-pointer hover:underline bg-primary/10 dark:bg-primary/30"
                onClick={(e: React.MouseEvent) => {
                  e.preventDefault()
                  e.stopPropagation()
                  if (!mindMap) return

                  // 显式 resolve 短 ID → UUID
                  let resolvedId = nodeId
                  const mapper = getModuleAIChatRuntime()?.getIdMapper() ?? null
                  if (mapper && SessionIdMapper.isShortId(nodeId)) {
                    resolvedId = mapper.tryResolve(nodeId)
                  }

                  mindMap?.execCommand?.('GO_TARGET_NODE', resolvedId)
                }}
                title={t('mindmap.aiChat.message.locateNode')}
              >
                {getPriorityBadge()}
                {children}
              </span>
            )
          } else if (className.includes('ztdl-unrecognized')) {
            return (
              <span
                className="inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-xs text-warning bg-warning/10 dark:bg-warning/30 border border-dashed border-warning/20 dark:border-warning"
                title={t('mindmap.aiChat.message.nodeUnrecognized')}
              >
                <HelpCircle className="size-3 flex-shrink-0 text-warning" />
                {getPriorityBadge()}
                {children}
              </span>
            )
          } else {
            return (
              <span
                className="inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-xs text-muted-foreground line-through cursor-default bg-muted/50"
                title={t('mindmap.aiChat.message.nodeDeleted')}
              >
                <Minus className="size-3 flex-shrink-0 text-destructive" />
                {getPriorityBadge()}
                {children}
              </span>
            )
          }
        }

        return <span className={className}>{children}</span>
      }
    }),
    [mindMap, t]
  )

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
        errorParts: errors
      }

    message.parts.forEach((part, index) => {
      const genericPart = part as GenericMessagePart
      const isToolType =
        typeof genericPart.type === 'string' && genericPart.type.startsWith('tool-')

      if (!isToolType && (genericPart.type === 'error' || genericPart.errorText)) {
        errors.push({ part: genericPart, index })
      } else if (isReasoningPart(part)) {
        if (part.text.trim()) {
          reasonings.push({ part, index })
        }
      } else if (part.type === 'text') {
        const textContent = typeof part.text === 'string' ? part.text : String(part.text || '')
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
      errorParts: errors
    }
  }, [message.parts])

  const useCollapsible = toolParts.length >= 2

  const hasTextContent = textParts.length > 0
  const hasToolContent = toolParts.length > 0
  const hasReasoningContent = reasoningParts.length > 0
  const hasErrorContent = errorParts.length > 0

  const retrieverResources = useMemo((): RetrieverResource[] => {
    const metadata = (message as UIMessageWithMetadata).metadata
    return metadata?.retriever_resources || []
  }, [message])

  const messageMeta = useMemo(() => {
    const metadata = (message as UIMessageWithMetadata).metadata
    if (!metadata) return null
    const { modelId, totalUsage } = metadata
    if (!modelId && !totalUsage) return null
    const tokens = totalUsage ? (totalUsage.inputTokens ?? 0) + (totalUsage.outputTokens ?? 0) : 0
    return { modelId, tokens: tokens > 0 ? tokens : undefined }
  }, [message])

  const renderTextPart = useCallback(
    (part: GenericMessagePart, key: number | string) => {
      const textContent = typeof part.text === 'string' ? part.text : String(part.text || '')
      if (!textContent.trim()) return null

      // 1. 处理转义字符（如 JSON 里的 \+ 变 +）
      const unescaped = textContent.replace(/\\([+\-~>=!])/g, '$1')

      // 2. 处理内联代码块中的 ZTDL 引用
      const codeUnescaped = unescaped.replace(INLINE_CODE_ZTDL_REGEX, '$1')

      // 3. 让 processMentions 把 ZTDL 格式转换为 HTML span
      const processedContent = processMentions(codeUnescaped, {
        resolveShortId: id => {
          const mapper = getModuleAIChatRuntime()?.getIdMapper() ?? null
          return mapper ? mapper.tryResolve(id) : id
        },
        findNode
      })

      return (
        <div key={key}>
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeRaw]}
            components={markdownComponents}
          >
            {processedContent}
          </ReactMarkdown>
        </div>
      )
    },
    [findNode, markdownComponents]
  )

  const lastActivePartIndex = useMemo(() => {
    if (!message.parts) return -1
    for (let i = message.parts.length - 1; i >= 0; i--) {
      const p = message.parts[i] as GenericMessagePart
      const isToolType = typeof p.type === 'string' && p.type.startsWith('tool-')
      if (p.type === 'error' || p.errorText) continue
      if (p.type === 'text') {
        const text = typeof p.text === 'string' ? p.text : String(p.text || '')
        if (text.trim()) return i
      }
      if (isReasoningPart(p)) {
        if (p.text.trim()) return i
      }
      if (isToolType) return i
    }
    return -1
  }, [message.parts])

  const renderPart = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (part: any, partIndex: number, isLastActive = false) => {
      const genericPart = part as GenericMessagePart
      const isToolType =
        typeof genericPart.type === 'string' && genericPart.type.startsWith('tool-')

      if (!isToolType && (genericPart.type === 'error' || genericPart.errorText)) return null

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
      if (part.type === 'text') {
        return renderTextPart(genericPart, isLastActive ? `last-${partIndex}` : partIndex)
      }
      if (isToolCallPart(part)) {
        return <ToolCallCard key={partIndex} part={part} />
      }
      return null
    },
    [isProcessing, isLast, message.parts, renderTextPart]
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
        text={textParts[0]?.part?.text || ''}
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
            <span>{t('mindmap.aiChat.message.abortedGeneration')}</span>
          </div>
        </div>
      )
    }
    return (
      <div className="relative group flex flex-col items-start">
        <div className="flex items-center gap-1.5 py-1 text-xs text-destructive/60">
          <span className="size-1.5 rounded-full bg-destructive flex-shrink-0" />
          <span>{t('mindmap.aiChat.message.emptyResponse')}</span>
        </div>
      </div>
    )
  }

  return (
    <div className="relative group flex flex-col items-start">
      <div className="flex flex-col p-2 rounded-lg w-full max-w-full break-words overflow-hidden">
        <div className="text-xs">
          {errorParts.map(({ part, index }) => {
            const raw = part.errorText || part.error || ''
            const code = classifyChatError(raw)
            return <ErrorCard key={index} code={code} isLast={isLast} />
          })}

          {useCollapsible ? (
            <CollapsibleSteps
              toolParts={toolParts}
              isProcessing={isProcessing && isLast}
              allParts={message.parts || []}
              lastActivePartIndex={lastActivePartIndex}
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
          <div className="flex items-center gap-1.5 mt-1 text-[10px] text-muted-foreground/40 select-none">
            {isAborted && (
              <>
                <Ban className="size-2.5" />
                <span>{t('mindmap.aiChat.message.aborted')}</span>
                {messageMeta && <span>·</span>}
              </>
            )}
            {messageMeta?.modelId && <span>{messageMeta.modelId}</span>}
            {messageMeta?.modelId && messageMeta?.tokens && <span>·</span>}
            {messageMeta?.tokens && <span>{messageMeta.tokens.toLocaleString()} tokens</span>}
          </div>
        )}

        {retrieverResources.length > 0 && (
          <div className="mt-2 pt-2 border-t border-border">
            <div className="flex items-center gap-1.5 flex-wrap text-[10px] text-muted-foreground">
              <span className="font-medium">{t('mindmap.aiChat.message.referenceSources')}</span>
              {retrieverResources.map((resource: RetrieverResource) => {
                return (
                  <div
                    key={resource.chunk_id || resource.position}
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-muted/50 transition-colors cursor-pointer"
                    onClick={() => setSelectedResource(resource)}
                  >
                    {resource.data_source_type === 'feishu_document' ? (
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
                {selectedResource.data_source_type === 'feishu_document' ? (
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
                  <span className="font-medium">{t('mindmap.aiChat.message.paragraphId')}</span>
                  <span className="font-mono text-xs">{selectedResource.block_id}</span>
                </div>
              )}
              {selectedResource.score && (
                <div className="text-sm text-muted-foreground">
                  <span className="font-medium">{t('mindmap.aiChat.message.relevance')}</span>
                  <span>{(selectedResource.score * 100).toFixed(1)}%</span>
                </div>
              )}
              {selectedResource.content && (
                <div className="mt-4 pt-4 border-t border-border">
                  <div className="text-sm font-medium text-foreground mb-2">
                    {t('mindmap.aiChat.message.contentSnippet')}
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
