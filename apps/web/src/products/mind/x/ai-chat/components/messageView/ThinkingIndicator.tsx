/**
 * ThinkingIndicator - 思考过程指示器
 *
 * - 思考中：展开显示 reasoning 实时文本流（自动展开）
 * - 完成后：自动收起为一行摘要，可点击展开查看全文
 */

import React, { useState, useEffect, useRef, useMemo } from "react"
import { AnimatePresence, motion } from "motion/react"
import { ChevronDown } from "lucide-react"
import { ChatMarkdown } from "./ChatMarkdown"
import { useTranslation } from "@zoeymind/i18n"

function extractReasoningHeading(text: string): string | undefined {
  const markdown = text.replace(/\r\n?/g, "\n")
  const headings: string[] = []

  for (const match of markdown.matchAll(/^\s{0,3}#{1,6}[ \t]+(.+?)(?:[ \t]+#+[ \t]*)?$/gm)) {
    const cleaned = match[1].replace(/[*_~`]+/g, "").trim()
    if (cleaned) headings.push(cleaned)
  }
  if (headings.length > 0) return headings[headings.length - 1]

  for (const match of markdown.matchAll(/^\s*(?:\*\*|__)(.+?)(?:\*\*|__)\s*$/gm)) {
    const cleaned = match[1].replace(/[*_~`]+/g, "").trim()
    if (cleaned) headings.push(cleaned)
  }
  if (headings.length > 0) return headings[headings.length - 1]

  return undefined
}

interface ThinkingIndicatorProps {
  text: string
  isStreaming?: boolean
}

export const ThinkingIndicator: React.FC<ThinkingIndicatorProps> = ({
  text,
  isStreaming = false,
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
          <ChevronDown className={`size-3 transition-transform ${expanded ? "rotate-180" : ""}`} />
        )}
        <span>
          {isStreaming
            ? t("mindmap.aiChat.message.thinkingShort")
            : t("mindmap.aiChat.message.thinkingProcess")}
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
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <div
              ref={contentRef}
              className="text-[11px] text-muted-foreground/60 pl-4 mt-1 max-h-[200px] overflow-y-auto leading-relaxed border-l border-muted-foreground/10"
            >
              <ChatMarkdown content={text} isStreaming={isStreaming} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
