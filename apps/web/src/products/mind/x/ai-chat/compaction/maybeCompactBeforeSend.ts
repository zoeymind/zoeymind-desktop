// @ts-nocheck — desktop mirror of cloud AI chat; runtime bridged via bridge.tsx
/**
 * Lazy context compaction — 用户发送消息前同步触发压缩.
 *
 * 业界标准, 对齐 cline `prepareTurn` 时机 (每次 model request 前检查):
 * https://github.com/cline/cline/blob/main/sdk/packages/core/src/extensions/context/compaction.ts
 *
 * vs. eager (AI 回答完立刻异步压) 的好处:
 *   - 用户没发下一轮就不压, 不浪费 cheap model 调用
 *   - 状态可预测: 压缩永远发生在 "用户点发送 → AI 响应" 之间
 *   - 失败不影响上一轮的 messages, 用户能 retry
 *
 * 触发条件:
 *   - totalTokens / contextWindow > 阈值 (默认 0.7)
 *   - messages 条数 > DEFAULT_KEEP_RECENT + 8
 *   - 第一条不是已经压过的 summary (避免重复压)
 *
 * 不触发 / 失败:
 *   - 静默 fallback, 用户的消息照常按原 messages 发, AI 可能因为爆 context 失败,
 *     但比"硬卡住用户"好
 */

import type { UIMessage } from '@ai-sdk/react'
import { useAIChatV2Store } from '../../ai-chat/stores/useAIChatV2Store'
import { logger } from '@zoeymind/logger'
import { getModuleAIChatRuntime } from '../../ai-chat/context/AIChatRuntimeContext'
import { runCompaction, DEFAULT_KEEP_RECENT } from './compactionClient'
import { useCompactionStore } from './useCompactionStore'

const AUTO_TRIGGER_RATIO = 0.7
const MIN_TOTAL_MESSAGES = DEFAULT_KEEP_RECENT + 8

/** 模型 context window 估算 (业界一致 fallback 到 128K). */
function estimateContextWindow(modelId: string | undefined): number {
  if (!modelId) return 128_000
  const m = modelId.toLowerCase()
  if (
    m.includes('claude') &&
    (m.includes('haiku-4') || m.includes('sonnet-4') || m.includes('opus-4'))
  ) {
    return 200_000
  }
  if (m.includes('gpt-5')) return 256_000
  if (m.includes('gpt-4')) return 128_000
  return 128_000
}

function findLatestModelId(messages: UIMessage[]): string | undefined {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i] as UIMessage & { metadata?: { modelId?: string } }
    if (m.metadata?.modelId) return m.metadata.modelId
  }
  return undefined
}

function isFirstMessageCompactSummary(messages: UIMessage[]): boolean {
  const first = messages[0] as UIMessage & { metadata?: { isCompactSummary?: boolean } }
  return !!first?.metadata?.isCompactSummary
}

export interface MaybeCompactInput {
  conversationId: string
  messages: UIMessage[]
}

/**
 * 在 store.sendMessage 内调用. 同步压缩, 完成后通过 runtime.setMessages 把 SDK 的
 * messages 数组就地替换, 让接下来的 sendMessage 用压缩后的版本.
 *
 * 注: 这里**等待**压缩完成才返回, 用户在 UI 上会看到 1-3 秒的延迟 (HoverCard 显示
 * "正在压缩历史以释放上下文"). 业界标准做法, 用户能理解.
 */
export async function maybeCompactBeforeSend(input: MaybeCompactInput): Promise<void> {
  const { conversationId, messages } = input

  if (messages.length < MIN_TOTAL_MESSAGES) return
  if (isFirstMessageCompactSummary(messages)) return

  // 拿当前 token 用量 (从 store 读, useTokenUsageReporter 会保持其和最近 metadata 同步)
  const totalUsage = useAIChatV2Store.getState().totalTokenUsage
  const modelId = findLatestModelId(messages)
  const contextWindow = estimateContextWindow(modelId)
  const ratio = totalUsage.total / contextWindow

  if (ratio < AUTO_TRIGGER_RATIO) return

  // organization id 从全局 react context 拿不到 (这是 store action), 只能让调用方传
  // 或者从 store 拿. 我们的 currentOrg 来自 zustand-less context, 这里临时通过模块全局
  // 函数暴露 — 见 useAIChat 顶层 setActiveOrganizationId.
  const orgId = getActiveOrganizationId()
  if (!orgId) {
    logger.warn('[Compaction] orgId 不可用, 跳过压缩')
    return
  }

  logger.info('[Compaction] 发送前触发压缩 (lazy)', {
    conversationId,
    messageCount: messages.length,
    totalTokens: totalUsage.total,
    contextWindow,
    ratio: ratio.toFixed(2),
    modelId
  })

  useCompactionStore.getState().setPhase('pending')

  try {
    const result = await runCompaction({
      conversationId,
      organizationId: orgId,
      messages,
      keepRecent: DEFAULT_KEEP_RECENT
    })

    const runtime = getModuleAIChatRuntime()
    runtime?.setMessages(result.newMessages)

    useCompactionStore.getState().setLastResult({
      compactedCount: result.compactedCount,
      modelId: result.modelId,
      at: Date.now()
    })

    logger.info('[Compaction] 发送前压缩完成', {
      conversationId,
      compactedCount: result.compactedCount,
      modelId: result.modelId
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    logger.warn('[Compaction] 发送前压缩失败 (静默, 继续按原 messages 发送)', { error: msg })
    useCompactionStore.getState().setError(msg)
    // 不抛, 让 sendMessage 继续按原 messages 发
  }
}

// ===== Module-level organization id (由 useAIChat 同步) =====
// store action 拿不到 React Context 里的 organization, 用模块全局桥接.
let activeOrganizationId: string | null = null

export function setActiveOrganizationId(orgId: string | null): void {
  activeOrganizationId = orgId
}

export function getActiveOrganizationId(): string | null {
  return activeOrganizationId
}
