// @ts-nocheck — desktop mirror of cloud AI chat; runtime bridged via bridge.tsx
/**
 * assistant 消息是否已有可渲染内容.
 *
 * MessageView 的等待 spinner 与 AssistantMessage 的空态判定共用本谓词,
 * 保证两处对"空"的定义一致 — 否则会出现判定错位: 流初期 SDK 先推
 * { type: 'text', text: '' } 空 part (parts.length=1 但无内容), 结构判断
 * (parts.length === 0) 认为"有内容"不显示 spinner, 内容判断认为"空"渲染 null,
 * 结果两边都不渲染, loading 出现空窗 (#62).
 *
 * 官方语义 (docs/research/ai-sdk-chat-streaming.md §3.3): 空 text/reasoning part
 * 是 text-start 到首个 delta 之间的正常瞬态.
 */
import type { UIMessage } from '@ai-sdk/react'

export function hasRenderableContent(message: UIMessage): boolean {
  const parts = message.parts ?? []
  return parts.some(part => {
    const p = part as { type?: string; text?: unknown; errorText?: string }
    if (typeof p.type === 'string' && p.type.startsWith('tool-')) return true
    if (p.type === 'error' || p.errorText) return true
    if (p.type === 'text' || p.type === 'reasoning') {
      return typeof p.text === 'string' && p.text.trim().length > 0
    }
    return false
  })
}
