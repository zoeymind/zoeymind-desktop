/** AI Chat 错误的分类、序列化与消息插入。 */

import type { UIMessage } from "@ai-sdk/react"
import { logger } from "@zoeymind/logger"

export type ChatErrorCode =
  "INSUFFICIENT_QUOTA" | "CONTEXT_OVERFLOW" | "REQUEST_FAILED" | "CLIENT_RUNTIME_ERROR"

export interface ChatErrorDetails {
  code: ChatErrorCode
  message?: string
}

interface ProviderRequestError {
  message?: unknown
}

const REDACTED = "[REDACTED]"

function sanitizeText(raw: string): string {
  return raw
    .replace(/(authorization\s*:\s*)(?:bearer\s+)?[^\r\n,;}]+/gi, `$1${REDACTED}`)
    .replace(
      /(["']?(?:key|api[-_]?key|token|cookie|secret|password)["']?\s*[:=]\s*)(["']?)[^\s,;}]+\2/gi,
      `$1$2${REDACTED}$2`
    )
    .replace(
      /([?&](?:key|api[-_]?key|authorization|token|cookie|secret|password)=)[^&#\s]*/gi,
      `$1${REDACTED}`
    )
}
export function serializeChatError(error: unknown): string {
  const candidate: ProviderRequestError = {}
  if (error && typeof error === "object" && "message" in error) candidate.message = error.message
  const details: ChatErrorDetails = {
    code: normalizeChatError(error),
    ...(typeof candidate.message === "string" && { message: sanitizeText(candidate.message) }),
  }
  return JSON.stringify(details)
}

export function parseChatError(error: unknown): ChatErrorDetails {
  const raw =
    error instanceof Error ? error.message : typeof error === "string" ? error : String(error)
  try {
    const parsed = JSON.parse(raw) as unknown
    if (parsed && typeof parsed === "object" && "code" in parsed) {
      const code = parsed.code
      if (typeof code === "string" && isKnownCode(code)) {
        const message = "message" in parsed ? parsed.message : undefined
        return {
          code: code as ChatErrorCode,
          ...(typeof message === "string" && { message }),
        }
      }
    }
  } catch {
    // Legacy error code or non-JSON provider message.
  }
  return { code: classifyChatError(raw) }
}
interface GenericPart {
  type: string
  toolName?: string
  errorText?: string
}

const KNOWN_CODES: readonly string[] = [
  "INSUFFICIENT_QUOTA",
  "CONTEXT_OVERFLOW",
  "REQUEST_FAILED",
  "CLIENT_RUNTIME_ERROR",
]

/** Classifies legacy codes and serialized provider error summaries. */
export function classifyChatError(error: Error | string | unknown): ChatErrorCode {
  const raw =
    error instanceof Error ? error.message : typeof error === "string" ? error : String(error)
  const trimmed = raw.trim()
  if (isKnownCode(trimmed)) return trimmed as ChatErrorCode

  const parsed = parseSerializedError(trimmed)
  if (parsed) return parsed

  // Legacy JSON form `{ error: "..." }`.
  try {
    const json = JSON.parse(trimmed) as unknown
    if (json && typeof json === "object" && "error" in json) {
      const val = json.error
      if (typeof val === "string" && isKnownCode(val)) return val as ChatErrorCode
    }
  } catch {
    // Not JSON; use the generic fallback.
  }

  return "REQUEST_FAILED"
}

function parseSerializedError(raw: string): ChatErrorCode | null {
  try {
    const parsed = JSON.parse(raw) as unknown
    if (parsed && typeof parsed === "object" && "code" in parsed) {
      const code = parsed.code
      if (typeof code === "string" && isKnownCode(code)) return code as ChatErrorCode
    }
  } catch {
    return null
  }
  return null
}

function isKnownCode(s: string): boolean {
  return KNOWN_CODES.includes(s)
}

const OVERFLOW_PHRASES = [
  "context_length_exceeded",
  "maximum context length",
  "prompt is too long",
  "too many tokens",
  "context window",
]
const REACT_RUNTIME_PHRASES = [
  "maximum update depth exceeded",
  "too many re-renders",
  "minified react error",
]

/** React 自身的不变量错误不是 AI provider / 网络错误，不能伪装成 REQUEST_FAILED。 */
export function isClientRuntimeError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : typeof error === "string" ? error : ""
  const normalized = message.toLowerCase()
  return (
    normalized === "client_runtime_error" ||
    REACT_RUNTIME_PHRASES.some(phrase => normalized.includes(phrase))
  )
}

export function normalizeChatError(error: unknown): ChatErrorCode {
  if (isClientRuntimeError(error)) return "CLIENT_RUNTIME_ERROR"
  const candidate = error as {
    statusCode?: number
    status?: number
    code?: string
    responseBody?: unknown
    data?: unknown
    message?: string
  }
  const structured = [candidate?.code, candidate?.responseBody, candidate?.data, candidate?.message]
    .map(value => {
      try {
        return typeof value === "string" ? value : JSON.stringify(value)
      } catch {
        return String(value)
      }
    })
    .join(" ")
    .toLowerCase()
  if (OVERFLOW_PHRASES.some(phrase => structured.includes(phrase))) return "CONTEXT_OVERFLOW"
  if (structured.includes("insufficient_quota") || structured.includes("quota exceeded")) {
    return "INSUFFICIENT_QUOTA"
  }
  return "REQUEST_FAILED"
}

/** part 是否是 error 类型 (展示用) */
export function hasErrorPart(message: UIMessage): boolean {
  return (
    message.parts?.some(part => {
      const generic = part as GenericPart
      const isTool =
        generic.type.startsWith("tool-") ||
        (generic.type === "dynamic-tool" && typeof generic.toolName === "string")
      return !isTool && (generic.type === "error" || !!generic.errorText)
    }) ?? false
  )
}

/** 在消息流尾部追加一个脱敏的错误摘要。 */
export function addErrorToMessages(
  messages: UIMessage[],
  error: Error | string,
  setMessages: (messages: UIMessage[]) => void
): void {
  const serialized = error instanceof Error ? error.message : error

  if (messages.length === 0) {
    logger.warn("[errorHandler] 没有消息, 无法添加错误")
    return
  }

  const lastMessage = messages[messages.length - 1]

  if (lastMessage.role === "assistant") {
    if (hasErrorPart(lastMessage)) {
      logger.debug("[errorHandler] 最后一条 assistant 已含错误, 跳过")
      return
    }
    const updated = {
      ...lastMessage,
      parts: [...(lastMessage.parts || []), { type: "error", errorText: serialized } as unknown],
    }
    setMessages([...messages.slice(0, -1), updated] as UIMessage[])
    return
  }

  if (lastMessage.role === "user") {
    const errorMsg = {
      id: `error-${Date.now()}`,
      role: "assistant" as const,
      parts: [{ type: "error", errorText: serialized }],
    }
    setMessages([...messages, errorMsg] as UIMessage[])
  }
}
