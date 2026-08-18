/**
 * compactionClient — 调后端 /api/ai-v2/compact + 写 chatDB 压缩备份.
 *
 * 设计:
 *   - keepRecent: 保留最近 N 条原文 (默认 12, 业界 Claude Code / Cursor 都在 10-15 之间)
 *   - 压缩范围: messages.slice(0, -keepRecent), 不包含最后 keepRecent 条
 *   - 备份: 写 chatDB.compactionBackups, 每 conversation 一份 (覆盖)
 *   - 输出: 一个 metadata.isCompactSummary=true 的 assistant 消息 + 最近 K 条原文
 */

import type { UIMessage } from '@ai-sdk/react'
import { chatDB } from '../../ai-chat/storage/chatDB'
import { logger } from '@zoeymind/logger'

/** 摘要消息的前缀, 用户能一眼看出"这条不是新对话, 是历史压缩" — 同时给 AI 信号识别. */
export const COMPACTION_HEADER =
  '📦 [对话历史已自动压缩 — 以下是工作交接备忘, 不是新的用户请求]\n\n'

export const DEFAULT_KEEP_RECENT = 12
export const DEFAULT_MIN_TO_COMPACT = 8

export interface CompactionRequest {
  conversationId: string
  organizationId: string
  messages: UIMessage[]
  /** 保留最近 N 条不动 (默认 12) */
  keepRecent?: number
}

export interface CompactionResult {
  /** 压缩后的新 messages 列表 (摘要消息 + 最近 K 条原文) */
  newMessages: UIMessage[]
  /** 被压缩的消息条数 */
  compactedCount: number
  /** 摘要文本 */
  summary: string
  /** 使用的模型 id */
  modelId: string
}

export async function runCompaction(req: CompactionRequest): Promise<CompactionResult> {
  const keepRecent = req.keepRecent ?? DEFAULT_KEEP_RECENT

  if (req.messages.length <= keepRecent + DEFAULT_MIN_TO_COMPACT) {
    throw new Error('compact-skip: 消息太少, 不值得压缩')
  }

  const toCompact = req.messages.slice(0, -keepRecent)
  const recent = req.messages.slice(-keepRecent)

  logger.info('[Compaction] 调后端压缩', {
    conversationId: req.conversationId,
    totalMessages: req.messages.length,
    toCompactCount: toCompact.length,
    keepRecent
  })

  const res = await fetch(`${import.meta.env.VITE_API_URL ?? ''}/api/ai-v2/compact`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      messages: toCompact,
      organizationId: req.organizationId
    })
  })

  if (!res.ok) {
    let errCode = 'REQUEST_FAILED'
    try {
      const json = (await res.json()) as { error?: string }
      if (json.error) errCode = json.error
    } catch {
      // ignore
    }
    throw new Error(`compact-failed: ${errCode}`)
  }

  const json = (await res.json()) as {
    success: boolean
    summary: string
    modelId: string
    compactedCount: number
  }

  if (!json.success || !json.summary) {
    throw new Error('compact-failed: empty summary')
  }

  const compactedAt = Date.now()

  // 备份压缩前原版 (每 conversation 一份, 覆盖旧的)
  await chatDB.putCompactionBackup({
    conversationId: req.conversationId,
    compactedAt,
    originalMessages: req.messages,
    summary: json.summary,
    modelId: json.modelId,
    compactedCount: json.compactedCount
  })

  // 构造摘要消息: assistant role + isCompactSummary metadata
  // text 前缀加 COMPACTION_HEADER, 让下一轮 AI 看到时知道这是历史摘要而不是新指令
  const summaryMsg: UIMessage = {
    id: `compact-${compactedAt}`,
    role: 'assistant',
    parts: [{ type: 'text', text: `${COMPACTION_HEADER}${json.summary}` }],
    metadata: {
      isCompactSummary: true,
      compactedCount: json.compactedCount,
      modelId: json.modelId,
      compactedAt
    }
  } as UIMessage

  return {
    newMessages: [summaryMsg, ...recent],
    compactedCount: json.compactedCount,
    summary: json.summary,
    modelId: json.modelId
  }
}
