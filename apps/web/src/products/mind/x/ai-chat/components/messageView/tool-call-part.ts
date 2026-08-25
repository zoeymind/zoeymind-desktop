export interface ToolCallPart {
  type: string
  toolName?: string
  toolCallId?: string
  input?: Record<string, unknown>
  output?: unknown
  state?: "input-streaming" | "input-available" | "output-available" | "output-error"
  errorText?: string
}

export function toolNameFromPart(part: ToolCallPart): string {
  return part.type === "dynamic-tool" ? (part.toolName ?? "") : part.type.replace("tool-", "")
}

export function isToolCallPart(part: unknown): part is ToolCallPart {
  if (typeof part !== "object" || part === null) return false
  const candidate = part as { type?: unknown; toolName?: unknown }
  return (
    (typeof candidate.type === "string" && candidate.type.startsWith("tool-")) ||
    (candidate.type === "dynamic-tool" && typeof candidate.toolName === "string")
  )
}
