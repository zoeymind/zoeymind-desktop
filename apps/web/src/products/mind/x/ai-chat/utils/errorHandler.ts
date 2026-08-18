/**
 * AI Chat 错误处理工具
 *
 * 与后端 (apps/api/src/handlers/openai-stream.ts) 约定: 错误**只**两种 code,
 * 全部上游/网络/分类细节由后端归并, 前端只做 i18n 渲染.
 *
 *   - INSUFFICIENT_QUOTA  额度不足 → 不可重试, 引导充值
 *   - REQUEST_FAILED      其它失败 → 可重试
 *
 * 后端 onError 把 vercel APICallError / streamText 错误压成上述 code 字符串写入流
 * (或 400/500 响应 body 的 { error: <code> })`. 前端不再尝试 unwrap 原始 message,
 * 因为那会泄露内部 AI 服务链路信息.
 */

import type { UIMessage } from '@ai-sdk/react'
import { logger } from '@zoeymind/logger'

export type ChatErrorCode = 'INSUFFICIENT_QUOTA' | 'REQUEST_FAILED'

interface GenericPart {
  type: string
  errorText?: string
}

const KNOWN_CODES: readonly string[] = ['INSUFFICIENT_QUOTA', 'REQUEST_FAILED']

/**
 * 解析后端返回的错误码. 后端要么直接给字符串 (流模式), 要么 wrap 成 JSON
 * `{ error: 'INSUFFICIENT_QUOTA' }` (4xx/5xx response). 不在白名单内的都归为
 * REQUEST_FAILED — 因为前端无权读原始 message.
 */
export function classifyChatError(error: Error | string | unknown): ChatErrorCode {
  const raw =
    error instanceof Error ? error.message : typeof error === 'string' ? error : String(error)
  const trimmed = raw.trim()

  // 直接字符串 (后端 onError 返回值)
  if (isKnownCode(trimmed)) return trimmed as ChatErrorCode

  // JSON 形式 `{ error: '...' }`
  try {
    const json = JSON.parse(trimmed) as unknown
    if (json && typeof json === 'object' && 'error' in json) {
      const val = (json as { error: unknown }).error
      if (typeof val === 'string' && isKnownCode(val)) return val as ChatErrorCode
    }
  } catch {
    // 不是 JSON, 走兜底
  }

  return 'REQUEST_FAILED'
}

function isKnownCode(s: string): boolean {
  return KNOWN_CODES.includes(s)
}

/** part 是否是 error 类型 (展示用) */
export function hasErrorPart(message: UIMessage): boolean {
  return (
    message.parts?.some(part => {
      const generic = part as GenericPart
      return generic.type === 'error' || !!generic.errorText
    }) ?? false
  )
}

/**
 * 在消息流尾部追加一个 error part. errorText 永远是 ChatErrorCode 字符串,
 * 渲染层 (ErrorCard) 拿到后做 i18n 翻译.
 */
export function addErrorToMessages(
  messages: UIMessage[],
  error: Error | string,
  setMessages: (messages: UIMessage[]) => void
): void {
  const code = classifyChatError(error)

  if (messages.length === 0) {
    logger.warn('[errorHandler] 没有消息, 无法添加错误')
    return
  }

  const lastMessage = messages[messages.length - 1]

  if (lastMessage.role === 'assistant') {
    if (hasErrorPart(lastMessage)) {
      logger.debug('[errorHandler] 最后一条 assistant 已含错误, 跳过')
      return
    }
    const updated = {
      ...lastMessage,
      parts: [...(lastMessage.parts || []), { type: 'error', errorText: code } as unknown]
    }
    setMessages([...messages.slice(0, -1), updated] as UIMessage[])
    return
  }

  if (lastMessage.role === 'user') {
    const errorMsg = {
      id: `error-${Date.now()}`,
      role: 'assistant' as const,
      parts: [{ type: 'error', errorText: code }]
    }
    setMessages([...messages, errorMsg] as UIMessage[])
  }
}
