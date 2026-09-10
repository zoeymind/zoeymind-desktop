/** Initializes conversations and persists completed message turns. */

import { useEffect, useRef, useState } from "react"
import { useAIChatV2Store } from "../../ai-chat/stores/useAIChatV2Store"
import { useTabs } from "@/shared/tabs/store"
import { sqliteChatStore } from "../storage/sqliteChatStore"
import { logger } from "@zoeymind/logger"
import type { UIMessage } from "@ai-sdk/react"
import { indexer } from "../../ai-chat/memory/indexer"

interface UseConversationLifecycleOptions {
  workspaceId?: string
  messages: UIMessage[]
  status: string
}

export interface UseConversationLifecycleResult {
  isInitialized: boolean
}

export function getWorkspaceConversationId(workspaceId: string | undefined): string | undefined {
  return workspaceId
    ? useAIChatV2Store.getState().conversationIdsByWorkspace[workspaceId]
    : undefined
}
export function useConversationLifecycle({
  workspaceId,
  messages,
  status,
}: UseConversationLifecycleOptions): UseConversationLifecycleResult {
  const [isInitialized, setIsInitialized] = useState(false)
  const initializedWorkspaceRef = useRef<string | undefined>(undefined)
  const active = useTabs(state => state.activeId === workspaceId)

  // 防抖保存消息到 IndexedDB; 流中不保存, 等结束再持久化.
  // 保存后顺手 enqueue 到长期记忆 indexer (内部检查总开关, 关闭时是 no-op).
  useEffect(() => {
    const conversationId = getWorkspaceConversationId(workspaceId)
    if (!conversationId || !isInitialized || messages.length === 0) return
    if (status === "streaming" || status === "submitted") return

    const timer = setTimeout(async () => {
      try {
        await sqliteChatStore.saveMessages(conversationId, messages)
        for (const message of messages) {
          if ((message.metadata as { isCompactSummary?: boolean } | undefined)?.isCompactSummary)
            continue
          indexer.enqueue(message, conversationId)
        }
      } catch (error) {
        logger.error("[useConversationLifecycle] Failed to save messages", { error })
      }
    }, 1000)

    return () => clearTimeout(timer)
  }, [messages, isInitialized, status, workspaceId])

  // Initialize the most recent conversation or create one for this workspace.
  useEffect(() => {
    if (!workspaceId || initializedWorkspaceRef.current === workspaceId) return
    initializedWorkspaceRef.current = workspaceId
    let cancelled = false

    const init = async () => {
      try {
        const conversations = await sqliteChatStore.getConversations(workspaceId)
        if (cancelled) return
        const store = useAIChatV2Store.getState()

        if (conversations.length > 0) {
          await store.loadConversation(conversations[0].id)
        } else {
          await store.createNewConversation(workspaceId)
        }

        if (cancelled) return
        setIsInitialized(true)
      } catch (error) {
        if (!cancelled) {
          initializedWorkspaceRef.current = undefined
          logger.error("[useConversationLifecycle] Failed to initialize conversation", { error })
        }
      }
    }

    void init()
    return () => {
      cancelled = true
      initializedWorkspaceRef.current = undefined
    }
  }, [workspaceId])

  useEffect(() => {
    if (active && isInitialized && workspaceId) {
      useAIChatV2Store.getState().selectWorkspaceConversation(workspaceId)
    }
  }, [active, isInitialized, workspaceId])

  return { isInitialized }
}
