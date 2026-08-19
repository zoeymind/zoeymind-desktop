// @ts-nocheck — desktop mirror of cloud AI chat; runtime bridged via bridge.tsx
/**
 * useMindmapContextSync — 管理 MindmapContextManager 的生命周期 + 跨对话快照同步.
 *
 * 拆分自 useAIChat.ts:
 *   - 初始化 / 跟随 mindMap 的可用性创建 Manager
 *   - 对话切换时把旧 Manager reset, 再尝试恢复新对话的快照
 *   - 把 pendingSnapshot 暂存 (Manager 还没创建时, 等就绪后由初始化 effect 拉起)
 */

import { useEffect } from 'react'
import { useMindMapStore } from '@/products/mind/features/mindmap/stores/mindmap-store'
import { useAIChatV2Store } from '../../ai-chat/stores/useAIChatV2Store'
import { MindmapContextManager } from '../../ai-chat/MindmapContextManager'
import { chatDB } from '../../ai-chat/storage/chatDB'
import { logger } from '@zoeymind/logger'
import type { ChatRuntime } from './internal/chatRuntime'

interface UseMindmapContextSyncOptions {
  runtime: ChatRuntime
  isInitialized: boolean
  workspaceId?: string
}

export function useMindmapContextSync({
  runtime,
  isInitialized,
  workspaceId
}: UseMindmapContextSyncOptions): void {
  const conversationId = useAIChatV2Store(s => s.currentConversationId)

  // 初始化 MindmapContextManager: 直到 mindMap 装载好为止.
  // cleanup 只在 workspaceId 真的切换 / 整个 hook 卸载时跑 (useMemo 稳定的 runtime 保证不会
  // 因 useAIChat re-render 把 Manager 置 null).
  useEffect(() => {
    const tryInit = () => {
      const mindMap = useMindMapStore.getState().mindMap
      if (mindMap && !runtime.mindmapContextManager.current) {
        runtime.mindmapContextManager.current = new MindmapContextManager(mindMap)
        // 检查是否有暂存的快照需要恢复 (解决 Manager 初始化晚于对话加载的竞态)
        if (runtime.pendingSnapshot.current) {
          runtime.mindmapContextManager.current.restoreSnapshot(runtime.pendingSnapshot.current)
          runtime.pendingSnapshot.current = null
        }
        return true
      }
      return false
    }

    if (tryInit()) {
      return () => {
        runtime.mindmapContextManager.current = null
      }
    }

    const unsub = useMindMapStore.subscribe((state, prevState) => {
      if (state.mindMap && !prevState.mindMap) {
        if (tryInit()) unsub()
      }
    })

    return () => {
      runtime.mindmapContextManager.current = null
      unsub()
    }
  }, [workspaceId, runtime])
  // 对话切换时同步快照: 先 reset, 再尝试恢复新对话的快照
  useEffect(() => {
    if (!isInitialized) return
    if (!conversationId) return

    let cancelled = false

    const syncSnapshot = async () => {
      const manager = runtime.mindmapContextManager.current
      if (!manager) {
        // Manager 还没创建, 把快照暂存
        try {
          const persisted = await chatDB.loadSnapshot(conversationId)
          if (!cancelled) runtime.pendingSnapshot.current = persisted ?? null
        } catch (error) {
          logger.warn('[useMindmapContextSync] 加载快照失败', { error })
        }
        return
      }

      manager.reset()
      try {
        const persisted = await chatDB.loadSnapshot(conversationId)
        if (!cancelled && persisted) manager.restoreSnapshot(persisted)
      } catch (error) {
        logger.warn('[useMindmapContextSync] 恢复快照失败', { error })
      }
    }

    syncSnapshot()
    return () => {
      cancelled = true
    }
  }, [isInitialized, runtime, conversationId])
}
