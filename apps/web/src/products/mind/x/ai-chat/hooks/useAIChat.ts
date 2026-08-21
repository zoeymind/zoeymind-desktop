/**
 * useAIChat — AI 聊天的薄壳编排器.
 *
 * Coordinates the Vercel AI SDK with transport, tool dispatch, persistence, and error recovery.
 */

import { useEffect, useMemo, useRef } from "react"
import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport, lastAssistantMessageIsCompleteWithToolCalls } from "ai"
import { useAIChatV2Store } from "../../ai-chat/stores/useAIChatV2Store"
import { logger } from "@zoeymind/logger"
import {
  addErrorToMessages,
  classifyChatError,
  isClientRuntimeError,
  type ChatErrorCode,
} from "../utils/errorHandler"
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
  const lastErrorCodeRef = useRef<ChatErrorCode | null>(null)
  const runtime = useMemo<ChatRuntime>(() => ({}), [])

  // customFetch: 上下文注入
  const customFetch = useChatTransport()

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
    // AI SDK 默认每个流 chunk / tool output 都同步通知 React。多工具轮次会在
    // WKWebView 中形成高密度外部 store 更新；官方建议节流 UI 通知以避免更新深度溢出。
    experimental_throttle: 50,
    transport,
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
    onError: error => {
      const errorMessage = error instanceof Error ? error.message : String(error)
      if (isClientRuntimeError(error)) {
        lastErrorCodeRef.current = null
        logger.error("[useAIChat] 客户端运行时错误", {
          code: "CLIENT_RUNTIME_ERROR",
          raw: errorMessage.slice(0, 200),
        })
        return
      }
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
      // SDK 回调保持非阻塞；dispatcher 内部仍须等待执行结果和 addToolOutput 持久化。
      // addToolOutput 自身由 AI SDK SerialJobExecutor 串行提交，不在这里建立第二条队列。
      void dispatcher.onToolCall(event)
    },
  })

  // 把 addToolOutput 给到 dispatcher 用 (用 ref 防止重建)
  const dispatcher = useToolDispatcher({
    runtime,
    addToolOutput: params => Promise.resolve(addToolOutput(params)),
  })

  const runtimeApi = useMemo<AIChatRuntime>(
    () => ({
      sendMessage: params => sdkSendMessage(params),
      regenerate: options => regenerate(options),
      stop: () => stop(),
      setMessages: msgs => setMessages(msgs),
      addToolOutput: params => Promise.resolve(addToolOutput(params)),
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
    if (isClientRuntimeError(chatError)) return
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
  useConversationLifecycle({ workspaceId, messages, status })

  useEffect(() => {
    return () => {
      resetOverflowRecovery()
      clearPreparedTurn()
    }
  }, [])

  return runtimeApi
}
