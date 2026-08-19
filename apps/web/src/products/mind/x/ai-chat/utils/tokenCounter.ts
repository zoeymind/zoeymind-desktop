// @ts-nocheck — desktop mirror of cloud AI chat; runtime bridged via bridge.tsx
/**
 * tokenCounter — 用 js-tiktoken 给 UI 显示更准的 token 数.
 *
 * 用 lite 版 + 静态 import o200k_base 词表 (GPT-4o / GPT-5 系当前主流, 也是 Anthropic
 * Claude / Gemini 模型最接近的近似), 不发 fetch 不阻塞.
 *
 * 仅用于 UI 显示 (ToolCallCard 的 "~N tokens" 提示). 真实 token 数走 streamText 的
 * finish.totalUsage, 那个是 provider 返的精确值.
 *
 * 错误兜底: 词表加载/encode 失败时回退 `Math.ceil(text.length / 4)` 字符估算.
 */

import { Tiktoken, type TiktokenBPE } from 'js-tiktoken/lite'
import o200k_base from 'js-tiktoken/ranks/o200k_base'

let encoder: Tiktoken | null = null

function getEncoder(): Tiktoken | null {
  if (encoder) return encoder
  try {
    encoder = new Tiktoken(o200k_base as TiktokenBPE)
    return encoder
  } catch {
    return null
  }
}

/**
 * 给一段纯文本估 token 数. 失败回退 chars / 4.
 *
 * 注: 对 OpenAI 系准, 对 Anthropic / Google 是近似 (它们的 tokenizer 不公开).
 */
export function countTokens(text: string): number {
  if (!text) return 0
  const enc = getEncoder()
  if (!enc) {
    return Math.ceil(text.length / 4)
  }
  try {
    return enc.encode(text).length
  } catch {
    return Math.ceil(text.length / 4)
  }
}

/**
 * 给任意 JSON-able 值估 token 数 (会先 JSON.stringify).
 * 给 ToolCallCard 显示 input + output 体积用.
 */
export function countTokensInValue(value: unknown): number {
  if (value == null) return 0
  if (typeof value === 'string') return countTokens(value)
  try {
    const serialized = JSON.stringify(value)
    return countTokens(serialized)
  } catch {
    return 0
  }
}
