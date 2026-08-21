import type { UIMessage } from "@ai-sdk/react"

interface ToolPartLike {
  type?: unknown
  state?: unknown
}

export function isPendingToolPart(part: unknown): boolean {
  if (!part || typeof part !== "object") return false
  const candidate = part as ToolPartLike
  return (
    typeof candidate.type === "string" &&
    candidate.type.startsWith("tool-") &&
    (candidate.state === "input-streaming" || candidate.state === "input-available")
  )
}

export function hasPendingToolCalls(messages: readonly UIMessage[]): boolean {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index]
    if (message.role !== "assistant") continue
    return message.parts?.some(isPendingToolPart) ?? false
  }
  return false
}
