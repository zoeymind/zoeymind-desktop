import { useMemo, type ReactNode } from "react"
import { Streamdown, type Components } from "streamdown"
import { cjk } from "@streamdown/cjk"
import { code } from "@streamdown/code"
import { math } from "@streamdown/math"
import { mermaid } from "@streamdown/mermaid"
import { VegaLiteRenderer } from "./VegaLiteRenderer"

const STREAMDOWN_PLUGINS = {
  cjk,
  code,
  math,
  mermaid,
  renderers: [{ language: "vega-lite", component: VegaLiteRenderer }],
}

const STREAMDOWN_CONTROLS = {
  table: { copy: true, download: false, fullscreen: true },
  code: { copy: true, download: false },
  mermaid: { copy: true, download: false, fullscreen: true, panZoom: true },
  image: { download: false },
}

const LEGACY_MENTION_RE =
  /<span\s+class="([^"]*\bmention-tag\b[^"]*)"(?:\s+data-node-id="([^"]+)")?[^>]*>([^<]*)<\/span>/g

function normalizeMentions(markdown: string): string {
  return markdown.replace(
    LEGACY_MENTION_RE,
    (_match, className: string, nodeId: string | undefined, label: string) =>
      `<mention class_name="${className}"${nodeId ? ` node_id="${nodeId}"` : ""}>${label}</mention>`
  )
}

const mentionComponent: Components[string] = props => {
  const className = typeof props.class_name === "string" ? props.class_name : undefined
  return <span className={className}>{props.children as ReactNode}</span>
}

interface ChatMarkdownProps {
  content: string
  isStreaming?: boolean
  className?: string
}

export function ChatMarkdown({ content, isStreaming = false, className }: ChatMarkdownProps) {
  const normalizedContent = useMemo(() => normalizeMentions(content), [content])

  return (
    <div data-chat-markdown className={className}>
      <Streamdown
        allowedTags={{ mention: ["class_name", "node_id"] }}
        components={{ mention: mentionComponent }}
        controls={STREAMDOWN_CONTROLS}
        isAnimating={isStreaming}
        plugins={STREAMDOWN_PLUGINS}
        linkSafety={{ enabled: false }}
        mode={isStreaming ? "streaming" : "static"}
      >
        {normalizedContent}
      </Streamdown>
    </div>
  )
}
