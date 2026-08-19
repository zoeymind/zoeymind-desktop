// @ts-nocheck — desktop mirror of cloud AI chat; runtime bridged via bridge.tsx
/**
 * useTokenUsageReporter — 从最新一条 assistant 消息的 metadata.totalUsage 取累计 token,
 * 同步到 store, 顶栏的 ContextUsageIndicator 用. 没有时清零.
 *
 * 拆分自 useAIChat.ts.
 */

import { useEffect } from 'react'
import type { UIMessage } from '@ai-sdk/react'
import { useAIChatV2Store } from '../../ai-chat/stores/useAIChatV2Store'
import type { UIMessageWithMetadata } from '../../ai-chat/types'

export function useTokenUsageReporter(messages: UIMessage[]): void {
  useEffect(() => {
    let latestUsage:
      | { inputTokens?: number; outputTokens?: number; totalTokens?: number }
      | undefined

    for (let i = messages.length - 1; i >= 0; i -= 1) {
      const metadata = (messages[i] as UIMessageWithMetadata)?.metadata
      if (metadata?.totalUsage) {
        latestUsage = metadata.totalUsage
        break
      }
    }

    const setTotal = useAIChatV2Store.getState().setTotalTokenUsage
    if (latestUsage) {
      setTotal({
        input: latestUsage.inputTokens || 0,
        output: latestUsage.outputTokens || 0,
        total: latestUsage.totalTokens || 0
      })
      return
    }
    setTotal({ input: 0, output: 0, total: 0 })
  }, [messages])
}
