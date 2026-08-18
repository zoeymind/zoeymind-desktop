// @ts-nocheck — dormant AI chat / MCP module (bridge.tsx flattens to no-op)
/**
 * ChatRuntime — useAIChat 拆分后的子 hook 之间共享的"运行时"句柄.
 *
 * 字段都是 useRef 包出来的可变容器, 由 useAIChat 这一层拥有, 通过参数传给
 * useChatTransport / useToolDispatcher / useMindmapContextSync 等子 hook.
 *
 * 这样做是为了:
 *   - 不暴露 useChat 的 SDK 句柄到 store 之外
 *   - 不在 5 个文件里重复声明 useRef
 *   - 让 customFetch 闭包总是看到最新的 mindmapContextManager / pendingSnapshot
 */

import type { MutableRefObject } from 'react'
import type { MindmapContextManager } from '../../../ai-chat/MindmapContextManager'
import type { PersistedSnapshot } from '../../../ai-chat/storage/chatDB'

export interface ChatRuntime {
  mindmapContextManager: MutableRefObject<MindmapContextManager | null>
  pendingSnapshot: MutableRefObject<PersistedSnapshot | null>
}