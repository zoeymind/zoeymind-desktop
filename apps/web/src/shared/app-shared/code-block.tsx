/**
 * CodeBlock —— 极简 markdown 代码块 renderer。
 *
 * 产品仓版走 shiki 高亮 + 富文本注入 mentions；桌面端第一版只保留 `<pre><code>`，
 * 未来若 mind features 需要高亮再补。
 */
import type { ReactNode } from 'react'

interface CodeBlockProps {
  code: string
  language?: string
  className?: string
  children?: ReactNode
}

export function CodeBlock({ code, language, className }: CodeBlockProps) {
  return (
    <pre className={className} data-language={language}>
      <code>{code}</code>
    </pre>
  )
}
