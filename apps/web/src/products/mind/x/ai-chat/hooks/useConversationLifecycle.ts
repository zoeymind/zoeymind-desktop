// @ts-nocheck — desktop mirror of cloud AI chat; runtime bridged via bridge.tsx
/**
 * useConversationLifecycle — 对话级别的 effect 集中地.
 *
 * 拆分自 useAIChat.ts:
 *   - 首次进入: 加载最近对话或创建新对话, 顺带把对话的思维导图快照拉起
 *   - 消息变化: 防抖保存到 IndexedDB
 *   - status === 'streaming' 时不保存, 等流结束再保存
 */

import { useEffect, useState } from "react"
import { useAIChatV2Store } from "../../ai-chat/stores/useAIChatV2Store"
import { chatDB } from "../../ai-chat/storage/chatDB"
import { logger } from "@zoeymind/logger"
import type { UIMessage } from "@ai-sdk/react"
import type { ChatRuntime } from "./internal/chatRuntime"
import { indexer } from "../../ai-chat/memory/indexer"
import { restorePendingFromMessages } from "../../ai-chat/context/ToolUIRegistry"

interface UseConversationLifecycleOptions {
  runtime: ChatRuntime
  workspaceId?: string
  messages: UIMessage[]
  status: string
}

export interface UseConversationLifecycleResult {
  isInitialized: boolean
}

export function useConversationLifecycle({
  runtime,
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
        await chatDB.saveMessages(currentConversationId, messages)
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

  // 初始化对话: 加载最近的或创建新的, 顺带把思维导图快照拉起
  useEffect(() => {
    if (!workspaceId || isInitialized) return

    const init = async () => {
      try {
        const conversations = await chatDB.getConversations(workspaceId)
        const store = useAIChatV2Store.getState()

        if (conversations.length > 0) {
          const latestConv = conversations[0]
          await store.loadConversation(latestConv.id)

          // 恢复思维导图快照 (如果有). Manager 可能还没初始化, 此时把快照暂存,
          // 等 useMindmapContextSync 那边的 Manager init effect 跑到时自动拉起.
          const persisted = await chatDB.loadSnapshot(latestConv.id)
          if (persisted) {
            if (runtime.mindmapContextManager.current) {
              runtime.mindmapContextManager.current.restoreSnapshot(persisted)
            } else {
              runtime.pendingSnapshot.current = persisted
            }
          }
        } else {
          await store.createNewConversation(workspaceId)
        }

        setIsInitialized(true)

        // 加载完 messages 后, 扫一次 pending tool UI calls (恢复刷新前没回答的弹框).
        // 注: useToolUI 注册 handler 是 mount 时 sync run, 这里 async 跑完时 handler
        // 已经在 registry 里, restorePendingFromMessages 能正确入队.
        // messages 由 useAIChat 传入, 这里直接用 (已经是 useChat 实时值)
        restorePendingFromMessages(messages)
      } catch (error) {
        logger.error("[useConversationLifecycle] Failed to initialize conversation", { error })
      }
    }

    init()
  }, [workspaceId, isInitialized, runtime])

  return { isInitialized }
}
