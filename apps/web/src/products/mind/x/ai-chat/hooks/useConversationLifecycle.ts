/** Initializes conversations and persists completed message turns. */

import { useEffect, useState } from "react"
import { useAIChatV2Store } from "../../ai-chat/stores/useAIChatV2Store"
import { sqliteChatStore } from "../storage/sqliteChatStore"
import { logger } from "@zoeymind/logger"
import type { UIMessage } from "@ai-sdk/react"
import { indexer } from "../../ai-chat/memory/indexer"
import { restorePendingFromMessages } from "../../ai-chat/context/ToolUIRegistry"

interface UseConversationLifecycleOptions {
  workspaceId?: string
  messages: UIMessage[]
  status: string
}

export interface UseConversationLifecycleResult {
  isInitialized: boolean
}

export function useConversationLifecycle({
  workspaceId,
  messages,
  status,
}: UseConversationLifecycleOptions): UseConversationLifecycleResult {
  const [isInitialized, setIsInitialized] = useState(false)
  const currentConversationId = useAIChatV2Store(s => s.currentConversationId)

  // 防抖保存消息到 IndexedDB; 流中不保存, 等结束再持久化.
  // 保存后顺手 enqueue 到长期记忆 indexer (内部检查总开关, 关闭时是 no-op).
  useEffect(() => {
    if (!currentConversationId || !isInitialized || messages.length === 0) return
    if (status === "streaming") return

    const timer = setTimeout(async () => {
      try {
        await sqliteChatStore.saveMessages(currentConversationId, messages)
        // 增量索引 (indexer 自己去重 + 串行 + 没启用时跳过)
        for (const m of messages) {
          if ((m.metadata as { isCompactSummary?: boolean } | undefined)?.isCompactSummary) continue
          indexer.enqueue(m, currentConversationId)
        }
      } catch (error) {
        logger.error("[useConversationLifecycle] Failed to save messages", { error })
      }
    }, 1000)

    return () => clearTimeout(timer)
  }, [messages, currentConversationId, isInitialized, status])

  // Initialize the most recent conversation or create one for this workspace.
  useEffect(() => {
    if (!workspaceId || isInitialized) return

    const init = async () => {
      try {
        const conversations = await sqliteChatStore.getConversations(workspaceId)
        const store = useAIChatV2Store.getState()

        if (conversations.length > 0) {
          await store.loadConversation(conversations[0].id)
        } else {
          await store.createNewConversation(workspaceId)
        }

        setIsInitialized(true)
        restorePendingFromMessages(messages)
      } catch (error) {
        logger.error("[useConversationLifecycle] Failed to initialize conversation", { error })
      }
    }

    void init()
  }, [workspaceId, isInitialized, messages])

  return { isInitialized }
}
