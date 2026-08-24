/**
 * MemoizedMarkdown — 按块 memo 的流式 Markdown 渲染.
 *
 * 问题: 流式输出时 AI SDK 每 ~50ms 换一次 messages 引用, ReactMarkdown 对
 * "不断增长的全文" 重跑 remark/rehype (含 rehypeRaw), 成本随文本长度线性增长,
 * 整条流下来是 O(n²) 的解析量 — 长回复尾段掉帧的主要来源之一.
 *
 * 方案: 把文本按空行切成块, 每块单独走一个 memo 的 ReactMarkdown.
 * 流式期间只有最后一块内容在变, 前面的块全部 memo 命中, 每 tick 只重解析尾块.
 *
 * 切块规则 (保持语义完整):
 *   - 代码围栏 (``` / ~~~) 内的空行不切;
 *   - 空行后若跟列表项/缩进续行, 不切 (loose list 保持同块, 避免 <ol> 重新编号);
 *   - 其余空行处切块.
 */

import React, { useMemo } from "react"
import ReactMarkdown from "react-markdown"
import type { Components } from "react-markdown"
import remarkGfm from "remark-gfm"
import rehypeRaw from "rehype-raw"
import { splitMarkdownBlocks } from "./split-markdown-blocks"

const REMARK_PLUGINS = [remarkGfm]
const REHYPE_PLUGINS = [rehypeRaw]

interface MarkdownBlockProps {
  content: string
  components: Components
}

const MarkdownBlock = React.memo<MarkdownBlockProps>(
  ({ content, components }) => (
    <ReactMarkdown
      remarkPlugins={REMARK_PLUGINS}
      rehypePlugins={REHYPE_PLUGINS}
      components={components}
    >
      {content}
    </ReactMarkdown>
  ),
  (prev, next) => prev.content === next.content && prev.components === next.components
)
MarkdownBlock.displayName = "MarkdownBlock"

interface MemoizedMarkdownProps {
  text: string
  components: Components
}

export const MemoizedMarkdown: React.FC<MemoizedMarkdownProps> = ({ text, components }) => {
  const blocks = useMemo(() => splitMarkdownBlocks(text), [text])
  // 块只会向尾部追加/最后一块变化, index key 让前缀块稳定命中 memo
  return (
    <>
      {blocks.map((block, index) => (
        <MarkdownBlock key={index} content={block} components={components} />
      ))}
    </>
  )
}
