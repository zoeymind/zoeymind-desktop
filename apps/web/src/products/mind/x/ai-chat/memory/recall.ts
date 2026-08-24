/**
 * Recall 流程 — 给当前 user 输入找出 top-K 相关历史消息, 拼成给 AI 的 system 注入文本.
 *
 * 调用时机: useChatTransport 在 fetch 拦截里, 拿到原始 messages 之后,
 *   1. 取最新的 user 消息文本 → embed
 *   2. searchSimilar 拿 top-K (排除"最近 recentN 条", 避免重复)
 *   3. 把召回结果格式化成 system 上下文文本
 *   4. customFetch 把这段文本塞进 body 让后端拼到 system prompt
 *
 * 失败兜底: 模型未 ready / embed 失败 / IndexedDB 错 → 返回 null, 调用方退化到全量发送.
 */

import { embedder } from "./embedder"
import { searchSimilar, type MemoryHit } from "./vectorStore"
import { getMemoryEnabled, getRecallK, getRecentN } from "./settings"
import type { UIMessage } from "@ai-sdk/react"
import { logger } from "@zoeymind/logger"

export interface RecallResult {
  /** 召回的历史命中 (按 score 倒序) */
  hits: MemoryHit[]
  /** 拼好的注入文本, 供后端 system prompt 追加 */
  injectedText: string
}

/**
 * 给定当前 query 文本和已经在 messages 列表里的"最近 N 条 messageId 集合",
 * 召回相关历史并格式化.
 *
 * 返回 null 表示"无召回 / 未启用 / 出错", 调用方应当透明地不注入.
 */
export async function recallForQuery(
  queryText: string,
  excludeIds: Set<string>
): Promise<RecallResult | null> {
  if (!getMemoryEnabled()) return null
  if (!queryText.trim()) return null
  if (embedder.getStatus().kind !== "ready") return null

  const k = getRecallK()
  if (k <= 0) return null

  const queryVec = await embedder.embed(queryText)
  if (!queryVec) return null

  const hits = await searchSimilar(queryVec, k, excludeIds)
  if (hits.length === 0) return null

  // 给 AI 的注入格式 — 标记清晰, 让 AI 知道这不是当前对话内容而是"用户记忆"
  const lines = hits.map((h, idx) => {
    const role = h.entry.role === "user" ? "用户" : "AI"
    const time = new Date(h.entry.timestamp).toLocaleString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
    return `[${idx + 1}] (${time}, ${role}) ${truncate(h.entry.text, 400)}`
  })
  const injectedText = `以下是用户在其它对话里说过的相关内容 (按相关度排序), 仅供参考, 不要直接复读:\n${lines.join("\n")}`

  logger.debug("[Memory] 召回命中", { k, count: hits.length, topScore: hits[0]?.score })

  return { hits, injectedText }
}

/**
 * 从 UIMessage[] 抽 "最近 recentN 条" 的 messageId 集合.
 * 用于 recall 排除, 避免召回到当前已经在 context 里的消息.
 */
export function getRecentMessageIds(messages: UIMessage[]): Set<string> {
  const n = getRecentN()
  const slice = messages.slice(-n)
  return new Set(slice.map(m => m.id))
}

/** 取最新一条 user 消息的纯文本 (拼接所有 text parts). 没有则返 '' */
export function extractLatestUserText(messages: UIMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i]
    if (msg.role !== "user") continue
    const text = (msg.parts ?? [])
      .filter((p): p is { type: "text"; text: string } => p.type === "text")
      .map(p => p.text)
      .join("\n")
    return text
  }
  return ""
}

function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max)}…` : s
}
