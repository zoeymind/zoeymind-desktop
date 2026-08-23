import { lastAssistantMessageIsCompleteWithToolCalls } from "ai"
import type { UIMessage } from "@ai-sdk/react"

export const TOOL_EXECUTION_INTERRUPTED = "TOOL_EXECUTION_INTERRUPTED"
interface ToolPartLike {
  type?: unknown
  state?: unknown
  errorText?: unknown
}

export function pendingToolCallIds(message: UIMessage): string[] {
  const ids: string[] = []
  for (const part of message.parts ?? []) {
    if (!isPendingToolPart(part)) continue
    const toolCallId = "toolCallId" in part ? part.toolCallId : undefined
    if (typeof toolCallId === "string") ids.push(toolCallId)
  }
  return ids
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

function latestAssistantMessage(messages: readonly UIMessage[]): UIMessage | undefined {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index]?.role === "assistant") return messages[index]
  }
  return undefined
}

export function isChatProcessing(
  status: string,
  messages: readonly UIMessage[],
  abortedMessageId: string | null
): boolean {
  const latest = latestAssistantMessage(messages)
  if (latest?.id === abortedMessageId) return false
  return status === "submitted" || status === "streaming" || hasPendingToolCalls(messages)
}
export function shouldAutoContinueAfterTools(
  messages: readonly UIMessage[],
  abortedMessageId: string | null
): boolean {
  const latest = latestAssistantMessage(messages)
  if (!latest || latest.id === abortedMessageId) return false
  return lastAssistantMessageIsCompleteWithToolCalls({ messages: [...messages] })
}

export function interruptPendingToolParts(message: UIMessage, errorText: string): UIMessage {
  const parts = [...(message.parts ?? [])]
  let changed = false
  for (let index = 0; index < parts.length; index += 1) {
    if (!isPendingToolPart(parts[index])) continue
    changed = true
    const part = parts[index] as (typeof parts)[number] & ToolPartLike
    parts[index] = { ...part, state: "output-error", errorText } as (typeof parts)[number]
  }
  return changed ? { ...message, parts } : message
}

/**
 * 流因错误中断后, 末条 assistant 里未写回结果的 tool part 会停留在
 * input-streaming / input-available, isChatProcessing 因此永久为 true.
 * 返回清理后的新数组; 无需清理时返回 null.
 */
export function interruptTrailingPendingToolParts(
  messages: readonly UIMessage[],
  errorText: string
): UIMessage[] | null {
  const last = messages[messages.length - 1]
  if (!last || last.role !== "assistant") return null
  const interrupted = interruptPendingToolParts(last, errorText)
  if (interrupted === last) return null
  return [...messages.slice(0, -1), interrupted]
}
