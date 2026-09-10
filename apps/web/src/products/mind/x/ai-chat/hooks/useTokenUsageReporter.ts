/**
 * Sync the latest request occupancy to the context indicator. Per-step context usage is
 * distinct from cumulative billing usage across a multi-step tool turn.
 */

import { useEffect } from "react"
import type { UIMessage } from "@ai-sdk/react"
import { buildActiveProjection } from "../compaction/ContextCompactor"
import { useCompactionStore } from "../compaction/useCompactionStore"
import type { CompactionState } from "../storage/sqliteChatStore"
import { useAIChatV2Store } from "../../ai-chat/stores/useAIChatV2Store"
import { countTokens } from "../utils/tokenCounter"
import type { UIMessageWithMetadata } from "../../ai-chat/types"
import { useTabs } from "@/shared/tabs/store"

export function readContextOccupancy(
  messages: UIMessage[],
  compaction: CompactionState | null = null
): number {
  const projection = buildActiveProjection(messages, compaction)
  const localEstimate = countTokens(JSON.stringify(projection))
  for (let i = projection.length - 1; i >= 0; i -= 1) {
    const metadata = (projection[i] as UIMessageWithMetadata)?.metadata
    const exact = metadata?.contextUsage?.totalTokens
    if (typeof exact === "number" && Number.isFinite(exact)) {
      const added = projection
        .slice(i + 1)
        .reduce((sum, message) => sum + countTokens(JSON.stringify(message)), 0)
      return Math.max(localEstimate, exact + added)
    }
  }
  return localEstimate
}

export function useTokenUsageReporter(messages: UIMessage[], workspaceId?: string): void {
  const activeId = useTabs(state => state.activeId)
  const conversationId = useAIChatV2Store(state => state.currentConversationId)
  const compaction = useCompactionStore(state =>
    state.conversationId === conversationId ? state.compaction : null
  )
  useEffect(() => {
    if (!workspaceId || activeId !== workspaceId) return
    const lastUser = [...messages].reverse().find(message => message.role === "user")
    const owner = (lastUser?.metadata as { conversationId?: string } | undefined)?.conversationId
    if (owner && owner !== conversationId) return
    const occupancy = readContextOccupancy(messages, compaction)
    useAIChatV2Store.getState().setTotalTokenUsage({
      input: occupancy,
      output: 0,
      total: occupancy,
    })
  }, [messages, compaction, workspaceId, activeId, conversationId])
}
