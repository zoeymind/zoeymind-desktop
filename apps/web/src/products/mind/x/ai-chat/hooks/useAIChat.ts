/**
 * useAIChat — AI 聊天的薄壳编排器.
 *
 * 把 Vercel AI SDK 的 useChat 串起来, 把每个子职责委托给独立的 hook:
 *   - useChatTransport          customFetch + 上下文注入
 *   - useToolDispatcher         onToolCall 大 switch
 *   - useMindmapContextSync     MindmapContextManager 生命周期 + 跨对话快照同步
 *   - useConversationLifecycle  对话初始化 + IndexedDB 持久化
 *   - useTokenUsageReporter     metadata.totalUsage → store
 *
 * 这里只保留:
 *   1. 创建子 hook 共享的 ChatRuntime (Manager / pendingSnapshot 的 ref)
 *   2. 把 useChat 的句柄 (sendMessage / stop / setMessages / addToolOutput)
 *      和 idMapper 通过 setModuleAIChatRuntime() 暴露给 store actions 和组件,
 *      替代之前把它们都塞进 Zustand 的反模式.
 *   3. 处理网络错误 → addErrorToMessages
 */

import { useEffect, useMemo, useRef } from "react"
import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport, lastAssistantMessageIsCompleteWithToolCalls } from "ai"
import { useOrganization } from "@/shared/app-shared"
import { useAIChatV2Store } from "../../ai-chat/stores/useAIChatV2Store"
import { logger } from "@zoeymind/logger"
import { addErrorToMessages, classifyChatError, type ChatErrorCode } from "../utils/errorHandler"
import type { MindmapContextManager } from "../../ai-chat/MindmapContextManager"
import type { PersistedSnapshot } from "../../ai-chat/storage/chatDB"
import type { ChatRuntime } from "./internal/chatRuntime"
import { clearPreparedTurn, useChatTransport } from "./useChatTransport"
import {
  clearOverflowRecovery,
  markOverflowError,
  resetOverflowRecovery,
  scheduleOverflowRecovery,
  shouldSuppressOverflowError,
} from "./overflowRecovery"
import { useToolDispatcher } from "./useToolDispatcher"
import { useMindmapContextSync } from "./useMindmapContextSync"
import { useConversationLifecycle } from "./useConversationLifecycle"
import { useTokenUsageReporter } from "./useTokenUsageReporter"
import {
  setModuleAIChatRuntime,
  getModuleAIChatRuntime,
  type AIChatRuntime,
} from "../../ai-chat/context/AIChatRuntimeContext"

function getAttemptKey(): string | null {
  const store = useAIChatV2Store.getState()
  const runtime = getModuleAIChatRuntime()
  const user = [...(runtime?.messages ?? [])].reverse().find(message => message.role === "user")
  return store.currentConversationId && user ? `${store.currentConversationId}:${user.id}` : null
}

function hasToolPart(message: unknown): boolean {
  if (!message || typeof message !== "object" || !("parts" in message)) return false
  const parts = message.parts
  return (
    Array.isArray(parts) &&
    parts.some(part => {
      if (!part || typeof part !== "object" || !("type" in part)) return false
      return typeof part.type === "string" && part.type.startsWith("tool-")
    })
  )
}

/**
 * 初始化 AI Chat: 创建 useChat 实例, 拉起所有子 effect, 返回 AIChatRuntime.
 * 由 AIChatProvider 在 MindMapCanvas 顶层调用一次; 返回值喂给 AIChatRuntimeProvider.
 */
export function useAIChat(workspaceId?: string): AIChatRuntime {
  const { currentOrg } = useOrganization()
  const currentOrgId = currentOrg?.id
  const currentConversationId = useAIChatV2Store(state => state.currentConversationId)
  const loadedConversationTranscript = useAIChatV2Store(state => state.loadedConversationTranscript)

  // 子 hook 共享的运行时句柄 — 由本 hook 拥有, 传给 transport / dispatcher / contextSync.
  // 必须用 useMemo 稳定对象引用, 不然每次 render 都是新对象, useMindmapContextSync 的
  // useEffect 把 [runtime] 当 dep 时就反复 cleanup → Manager 一直被置 null, 上下文丢失,
  // 导致 AI 看不到现有 mindmap 结构, 只能在根目录瞎建.
  const mindmapContextManagerRef = useRef<MindmapContextManager | null>(null)
  const pendingSnapshotRef = useRef<PersistedSnapshot | null>(null)
  const lastErrorCodeRef = useRef<ChatErrorCode | null>(null)
  const runtime = useMemo<ChatRuntime>(
    () => ({
      mindmapContextManager: mindmapContextManagerRef,
      pendingSnapshot: pendingSnapshotRef,
    }),
    []
  )

  // customFetch: 上下文注入
  const customFetch = useChatTransport({ runtime, currentOrgId })

  // useChat: SDK 实例 (addToolOutput 由下面的 dispatcher 用, 这里要先拿到)
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: `${import.meta.env.VITE_API_URL ?? ""}/api/ai-v2/chat`,
        fetch: customFetch,
        prepareSendMessagesRequest: ({ messages, trigger, body }) => {
          const latestUser = [...messages].reverse().find(message => message.role === "user")
          const metadata = latestUser?.metadata as { model?: string } | undefined
          return { body: { ...body, messages, model: metadata?.model, trigger } }
        },
      }),
    [customFetch]
  )

  const {
    messages,
    sendMessage: sdkSendMessage,
    regenerate,
    addToolOutput,
    status,
    setMessages,
    stop,
    error: chatError,
  } = useChat({
    id: currentConversationId ?? "uninitialized",
    messages: loadedConversationTranscript,
    transport,
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
    onError: error => {
      const errorMessage = error instanceof Error ? error.message : String(error)
      const code = classifyChatError(errorMessage)
      lastErrorCodeRef.current = code
      markOverflowError(code, getAttemptKey())
      logger.error("[useAIChat] 收到错误", { code, raw: errorMessage.slice(0, 200) })
    },
    onFinish: ({ message, isError }) => {
      scheduleOverflowRecovery({
        code: lastErrorCodeRef.current,
        attemptKey: getAttemptKey(),
        isError,
        hasToolPart: hasToolPart(message),
        regenerate: attemptKey => {
          getModuleAIChatRuntime()?.regenerate({
            body: { compactionMode: "force-overflow-recovery", logicalTurnId: attemptKey },
          })
        },
      })
    },
    onToolCall: event => {
      // AI SDK 要求 client tool 在 onToolCall 中 fire-and-forget；await 会与
      // addToolOutput 的同步 message update 形成重入，尤其并行工具会触发更新深度错误。
      void dispatcher.onToolCall(event)
    },
  })

  // 把 addToolOutput 给到 dispatcher 用 (用 ref 防止重建)
  const dispatcher = useToolDispatcher({
    runtime,
    addToolOutput: params => Promise.resolve(addToolOutput(params)),
  })

  // 构造 AIChatRuntime: 把 useChat 的句柄 + idMapper 访问通过模块单例暴露给
  // 1) 组件 (UserMessage / AssistantMessage / MindMapCanvas via useAIChatRuntime)
  // 2) Store actions (submitCaseConfirm / sendMessage / stopGeneration via getModuleAIChatRuntime)
  const runtimeApi = useMemo<AIChatRuntime>(
    () => ({
      sendMessage: params => sdkSendMessage(params),
      regenerate: options => regenerate(options),
      stop: () => stop(),
      setMessages: msgs => setMessages(msgs),
      addToolOutput: params => Promise.resolve(addToolOutput(params)),
      getIdMapper: () => mindmapContextManagerRef.current?.idMapper ?? null,
      shortenId: uuid => {
        const mapper = mindmapContextManagerRef.current?.idMapper
        return mapper ? mapper.shorten(uuid) : uuid
      },
      messages,
      status,
      error: chatError,
    }),
    [sdkSendMessage, regenerate, stop, setMessages, addToolOutput, messages, status, chatError]
  )

  useEffect(() => {
    setModuleAIChatRuntime(runtimeApi)
    return () => {
      setModuleAIChatRuntime(null)
    }
  }, [runtimeApi])
  // 处理 chatError: 插入错误 part + 恢复输入框 (错误写入的唯一路径).
  // AI SDK streamText 的 maxRetries: 2 已覆盖网络层重试.
  // deps 只挂 chatError: 触发时经 module runtime 读最新 messages, 避免 messages
  // 每次流式更新都重排定时器.
  useEffect(() => {
    if (!chatError) return
    const timer = setTimeout(() => {
      const store = useAIChatV2Store.getState()
      const latest = getModuleAIChatRuntime()
      const currentMessages = latest?.messages ?? []
      const attemptKey = getAttemptKey()
      const code = classifyChatError(chatError)
      if (shouldSuppressOverflowError(code, attemptKey)) return
      if (attemptKey) {
        clearOverflowRecovery(attemptKey)
        clearPreparedTurn(attemptKey)
      }
      addErrorToMessages(currentMessages, chatError, next => latest?.setMessages(next))
      if (store.lastSentInput && !store.inputMessage) store.restoreInput()
    }, 200)
    return () => clearTimeout(timer)
  }, [chatError])

  // token 使用同步
  useTokenUsageReporter(messages)

  // 对话初始化 / 持久化
  const { isInitialized } = useConversationLifecycle({
    runtime,
    workspaceId,
    messages,
    status,
  })

  // 思维导图上下文 Manager 生命周期 + 跨对话快照同步
  useMindmapContextSync({ runtime, isInitialized, workspaceId })

  useEffect(() => {
    return () => {
      resetOverflowRecovery()
      clearPreparedTurn()
    }
  }, [])

  return runtimeApi
}
