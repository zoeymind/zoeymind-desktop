// @ts-nocheck — dormant AI chat / MCP module (bridge.tsx flattens to no-op)
/**
 * ThinkingIndicator - 思考过程指示器
 *
 * - 思考中：展开显示 reasoning 实时文本流（自动展开）
 * - 完成后：自动收起为一行摘要，可点击展开查看全文
 */

import React, { useState, useEffect, useRef, useMemo } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ChevronDown } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import type { Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useTranslation } from '@zoeymind/i18n'

function extractReasoningHeading(text: string): string | undefined {
  const markdown = text.replace(/\r\n?/g, '\n')
  const headings: string[] = []

  for (const match of markdown.matchAll(/^\s{0,3}#{1,6}[ \t]+(.+?)(?:[ \t]+#+[ \t]*)?$/gm)) {
    const cleaned = match[1].replace(/[*_~`]+/g, '').trim()
    if (cleaned) headings.push(cleaned)
  }
  if (headings.length > 0) return headings[headings.length - 1]

  for (const match of markdown.matchAll(/^\s*(?:\*\*|__)(.+?)(?:\*\*|__)\s*$/gm)) {
    const cleaned = match[1].replace(/[*_~`]+/g, '').trim()
    if (cleaned) headings.push(cleaned)
  }
  if (headings.length > 0) return headings[headings.length - 1]

  return undefined
}

const mdComponents: Components = {
  p: ({ children }) => <p className="my-0.5">{children}</p>,
  code: ({ className, children, ...props }) => {
    const isBlock = /language-(\w+)/.test(className || '')
    if (isBlock) {
      return (
        <pre className="my-1 p-1.5 rounded bg-muted overflow-x-auto">
          <code className="font-mono text-[10px]" {...props}>
            {children}
          </code>
        </pre>
      )
    }
    return (
      <code className="rounded bg-muted px-1 py-0.5 font-mono text-[10px]" {...props}>
        {children}
      </code>
    )
  },
  pre: ({ children }) => <>{children}</>,
  ul: ({ children }) => <ul className="my-0.5 list-disc pl-4">{children}</ul>,
  ol: ({ children }) => <ol className="my-0.5 list-decimal pl-4">{children}</ol>,
  li: ({ children }) => <li className="my-0">{children}</li>,
  blockquote: ({ children }) => (
    <blockquote className="my-1 border-l-2 border-muted-foreground/20 pl-2">{children}</blockquote>
  ),
  table: ({ children }) => (
    <div className="my-1 overflow-x-auto">
      <table className="border-collapse text-[10px]">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border border-muted px-1.5 py-0.5 text-left font-medium">{children}</th>
  ),
  td: ({ children }) => <td className="border border-muted px-1.5 py-0.5">{children}</td>
}

interface ThinkingIndicatorProps {
  text: string
  isStreaming?: boolean
}

export const ThinkingIndicator: React.FC<ThinkingIndicatorProps> = ({
  text,
  isStreaming = false
}) => {
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState(isStreaming)
  const prevStreamingRef = useRef(isStreaming)
  const contentRef = useRef<HTMLDivElement>(null)
  const heading = useMemo(() => extractReasoningHeading(text), [text])

  useEffect(() => {
    if (isStreaming && !prevStreamingRef.current) {
      setExpanded(true)
    } else if (!isStreaming && prevStreamingRef.current) {
      setExpanded(false)
    }
    prevStreamingRef.current = isStreaming
  }, [isStreaming])

  useEffect(() => {
    if (isStreaming && expanded && contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight
    }
  }, [text, isStreaming, expanded])

  if (!text.trim() && !isStreaming) return null

  return (
    <div className="my-0.5">
      <button
        type="button"
        onClick={() => setExpanded(prev => !prev)}
        className="flex items-center gap-1.5 text-[11px] text-muted-foreground/50 hover:text-muted-foreground/70 transition-colors select-none py-0.5"
      >
        {isStreaming ? (
          <span className="inline-block size-3 rounded-full border-2 border-primary/30 border-t-primary animate-spin flex-shrink-0" />
        ) : (
          <ChevronDown className={`size-3 transition-transform ${expanded ? 'rotate-180' : ''}`} />
        )}
        <span>
          {isStreaming
            ? t('mindmap.aiChat.message.thinkingShort')
            : t('mindmap.aiChat.message.thinkingProcess')}
        </span>
        {heading && (
          <>
            <span className="text-muted-foreground/20">·</span>
            <span className="truncate max-w-[200px]">{heading}</span>
          </>
        )}
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <div
              ref={contentRef}
              className="text-[11px] text-muted-foreground/60 pl-4 mt-1 max-h-[200px] overflow-y-auto leading-relaxed border-l border-muted-foreground/10"
            >
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
                {text}
              </ReactMarkdown>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}