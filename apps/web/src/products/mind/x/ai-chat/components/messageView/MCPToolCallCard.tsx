import { useMemo, useState } from "react"
import { useTranslation } from "@zoeymind/i18n"
import { Badge } from "@zoeymind/ui"
import { Check, Loader2, TriangleAlert } from "lucide-react"
import type { ToolCallPart } from "./tool-call-part"
import { ToolCallDetail, ToolCallRow, type ToolCallRowTone } from "./ToolCallRow"

const MAX_DETAIL_CHARS = 4_000

function parseMcpToolName(name: string): { server: string; tool: string } | null {
  if (!name.startsWith("mcp_")) return null
  const separator = name.indexOf("_", 4)
  if (separator < 0) return null
  return {
    server: name.slice(4, separator),
    tool: name.slice(separator + 1).replaceAll("_", " "),
  }
}

function detail(value: unknown): { text: string; truncated: boolean } | null {
  if (value === undefined) return null
  const text = typeof value === "string" ? value : JSON.stringify(value, null, 2)
  return text.length > MAX_DETAIL_CHARS
    ? { text: text.slice(0, MAX_DETAIL_CHARS), truncated: true }
    : { text, truncated: false }
}

interface MCPToolCallCardProps {
  part: ToolCallPart
  toolName: string
}

export function MCPToolCallCard({ part, toolName }: MCPToolCallCardProps) {
  const parsed = parseMcpToolName(toolName)
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const input = useMemo(() => detail(part.input), [part.input])
  const output = useMemo(() => detail(part.output), [part.output])
  if (!parsed) return null

  const pending = part.state === "input-streaming" || part.state === "input-available"
  const failed = part.state === "output-error"
  const expandable = input !== null || output !== null || failed
  const status = pending
    ? t("mindmap.aiChat.message.mcpRunning")
    : failed
      ? t("mindmap.aiChat.message.mcpFailed")
      : t("mindmap.aiChat.message.mcpCompleted")
  const tone: ToolCallRowTone = failed ? "destructive" : pending ? "active" : "default"
  const icon = pending ? (
    <Loader2 className="size-3 animate-spin" />
  ) : failed ? (
    <TriangleAlert className="size-3" />
  ) : (
    <Check className="size-3 text-success" />
  )

  return (
    <ToolCallRow
      open={open}
      onOpenChange={setOpen}
      expandable={expandable}
      icon={icon}
      badge={
        <Badge variant="outline" className="h-4 shrink-0 px-1 text-[9px] font-medium">
          MCP
        </Badge>
      }
      title={parsed.server}
      meta={parsed.tool}
      status={status}
      tone={tone}
      detail={
        <div className="space-y-1.5 border-l border-border/60 py-1 pl-2">
          {input ? (
            <DetailBlock label={t("mindmap.aiChat.message.inputLabel")} value={input} />
          ) : null}
          {failed && part.errorText ? (
            <ToolCallDetail label={t("mindmap.aiChat.message.errorLabel")} tone="destructive">
              <div className="whitespace-pre-wrap text-[11px] text-destructive">
                {part.errorText}
              </div>
            </ToolCallDetail>
          ) : null}
          {output ? (
            <DetailBlock label={t("mindmap.aiChat.message.outputLabel")} value={output} />
          ) : null}
        </div>
      }
    />
  )
}

function DetailBlock({
  label,
  value,
}: {
  label: string
  value: { text: string; truncated: boolean }
}) {
  return (
    <ToolCallDetail label={label}>
      <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-all font-mono text-[10px] leading-relaxed text-foreground/80">
        {value.text}
      </pre>
      {value.truncated ? (
        <div className="mt-1 text-[10px] text-muted-foreground">
          {`内容过长，仅显示前 ${MAX_DETAIL_CHARS.toLocaleString()} 个字符`}
        </div>
      ) : null}
    </ToolCallDetail>
  )
}
