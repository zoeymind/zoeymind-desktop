/**
 * useAIChat — AI 聊天的薄壳编排器.
 *
 * Coordinates the Vercel AI SDK with transport, tool dispatch, persistence, and error recovery.
 */

import { useEffect, useMemo, useRef } from "react"
import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport } from "ai"
import { useAIChatV2Store } from "../stores/useAIChatV2Store"
import { logger } from "@zoeymind/logger"
import {
  addErrorToMessages,
  classifyChatError,
  isClientRuntimeError,
  type ChatErrorCode,
} from "../utils/errorHandler"
import {
  interruptTrailingPendingToolParts,
  shouldAutoContinueAfterTools,
  TOOL_EXECUTION_INTERRUPTED,
} from "../utils/pendingToolCalls"
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
  registerModuleAIChatRuntime,
  unregisterModuleAIChatRuntime,
  type AIChatRuntime,
} from "../context/ai-chat-runtime"

function getCurrentConversationId(workspaceId?: string): string | undefined {
  if (!workspaceId) return undefined
  return useAIChatV2Store.getState().conversationIdsByWorkspace[workspaceId]
}

function getAttemptKey(messages: unknown[], workspaceId?: string): string | null {
  const user = [...messages]
    .reverse()
    .find(
      message =>
        !!message && typeof message === "object" && "role" in message && message.role === "user"
    ) as { id?: unknown } | undefined
  const conversationId = getCurrentConversationId(workspaceId)
  return conversationId && typeof user?.id === "string" ? `${conversationId}:${user.id}` : null
}

function hasToolPart(message: unknown): boolean {
  if (!message || typeof message !== "object" || !("parts" in message)) return false
  const parts = message.parts
  return (
    Array.isArray(parts) &&
    parts.some(part => {
      if (!part || typeof part !== "object" || !("type" in part)) return false
      const candidate = part as { type?: unknown; toolName?: unknown }
      return (
        (typeof candidate.type === "string" && candidate.type.startsWith("tool-")) ||
        (candidate.type === "dynamic-tool" && typeof candidate.toolName === "string")
      )
    })
  )
}

export interface SettledFetchTracker {
  fetch: typeof fetch
  settle: () => Promise<void>
}

export function trackFetchSettlement(sourceFetch: typeof fetch): SettledFetchTracker {
  const active = new Set<Promise<void>>()
  return {
    fetch: async (input, init) => {
      let settleRequest: (() => void) | undefined
      const settled = new Promise<void>(resolve => {
        settleRequest = resolve
      })
      active.add(settled)
      const settle = () => {
        settleRequest?.()
        active.delete(settled)
      }
      try {
        const response = await sourceFetch(input, init)
        if (!response.body) {
          settle()
          return response
        }
        const reader = response.body.getReader()
        const body = new ReadableStream<Uint8Array>({
          async pull(controller) {
            try {
              const chunk = await reader.read()
              if (chunk.done) {
                settle()
                controller.close()
              } else {
                controller.enqueue(chunk.value)
              }
            } catch (error) {
              settle()
              controller.error(error)
            }
          },
          async cancel(reason) {
            try {
              await reader.cancel(reason)
            } finally {
              settle()
            }
          },
        })
        return new Response(body, response)
      } catch (error) {
        settle()
        throw error
      }
    },
    settle: async () => {
      while (active.size > 0) await Promise.allSettled([...active])
    },
  }
}

/**
 * 初始化 AI Chat: 创建 useChat 实例, 拉起所有子 effect, 返回 AIChatRuntime.
 * 由 AIChatProvider 在 MindMapCanvas 顶层调用一次; 返回值喂给 AIChatRuntimeProvider.
 */
function createGenerationRuntime(workspaceId?: string) {
  let generation = 0
  const runtime: ChatRuntime = {
    get generation() {
      return generation
    },
    workspaceId,
  }
  return {
    runtime,
    invalidateGeneration: () => {
      generation += 1
    },
  }
}

export function useAIChat(workspaceId?: string): AIChatRuntime {
  const lastErrorCodeRef = useRef<ChatErrorCode | null>(null)
  const { runtime, invalidateGeneration } = useMemo(
    () => createGenerationRuntime(workspaceId),
    [workspaceId]
  )
  const registrationOwner = useMemo(() => Symbol("ai-chat-runtime"), [])
  const messagesRef = useRef<AIChatRuntime["messages"]>([])
  const statusRef = useRef("ready")
  const statusSettlementWaitersRef = useRef(new Set<() => void>())
  const errorAttemptRef = useRef<{
    error: Error
    runtime: ChatRuntime
    generation: number
    attemptKey: string | null
  } | null>(null)
  const handledErrorRef = useRef<Error | null>(null)
  const runtimeApiRef = useRef<AIChatRuntime | null>(null)

  // customFetch: 上下文注入
  const customFetch = useChatTransport(workspaceId)
  const settledFetch = useMemo(() => trackFetchSettlement(customFetch), [customFetch])

  // useChat: SDK 实例 (addToolOutput 由下面的 dispatcher 用, 这里要先拿到)
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: `${import.meta.env.VITE_API_URL ?? ""}/api/ai-v2/chat`,
        fetch: settledFetch.fetch,
        prepareSendMessagesRequest: ({ messages, trigger, body }) => {
          const latestUser = [...messages].reverse().find(message => message.role === "user")
          const metadata = latestUser?.metadata as
            { model?: string; conversationId?: string } | undefined
          return {
            body: {
              ...body,
              messages,
              model: metadata?.model,
              conversationId: metadata?.conversationId ?? getCurrentConversationId(workspaceId),
              workspaceId,
              trigger,
            },
          }
        },
      }),
    [settledFetch, workspaceId]
  )

  const {
    messages,
    sendMessage: sdkSendMessage,
    regenerate,
    addToolOutput,
    status,
    setMessages,
    stop,
    clearError,
    error: chatError,
  } = useChat({
    id: workspaceId,
    experimental_throttle: 50,
    transport,
    sendAutomaticallyWhen: ({ messages: currentMessages }) =>
      shouldAutoContinueAfterTools(currentMessages, useAIChatV2Store.getState().abortedMessageId),
    onError: error => {
      errorAttemptRef.current = {
        error,
        runtime,
        generation: runtime.generation,
        attemptKey: getAttemptKey(messagesRef.current, workspaceId),
      }
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
      markOverflowError(code, getAttemptKey(messagesRef.current, workspaceId))
      logger.error("[useAIChat] 收到错误", { code, raw: errorMessage.slice(0, 200) })
    },
    onFinish: ({ message, isError }) => {
      scheduleOverflowRecovery({
        code: lastErrorCodeRef.current,
        attemptKey: getAttemptKey(messagesRef.current, workspaceId),
        isError,
        hasToolPart: hasToolPart(message),
        regenerate: attemptKey => {
          void regenerate({
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

  useEffect(() => {
    statusRef.current = status
    if (status === "streaming" || status === "submitted") return
    for (const resolve of statusSettlementWaitersRef.current) resolve()
    statusSettlementWaitersRef.current.clear()
  }, [status])

  useEffect(
    () => () => {
      for (const resolve of statusSettlementWaitersRef.current) resolve()
      statusSettlementWaitersRef.current.clear()
    },
    []
  )
  useEffect(() => {
    messagesRef.current = messages
  }, [messages])

  // 把 addToolOutput 给到 dispatcher 用 (用 ref 防止重建)
  const dispatcher = useToolDispatcher({
    runtime,
    addToolOutput: params => Promise.resolve(addToolOutput(params)),
  })

  const runtimeApi = useMemo<AIChatRuntime>(
    () => ({
      workspaceId,
      instanceId: registrationOwner,
      sendMessage: params => Promise.resolve(sdkSendMessage(params)),
      regenerate: options => Promise.resolve(regenerate(options)),
      stop: async () => {
        invalidateGeneration()
        const statusSettled =
          statusRef.current === "streaming" || statusRef.current === "submitted"
            ? new Promise<void>(resolve => {
                statusSettlementWaitersRef.current.add(resolve)
              })
            : Promise.resolve()
        await Promise.resolve(stop())
        await settledFetch.settle()
        await statusSettled
      },
      setMessages: msgs => {
        invalidateGeneration()
        errorAttemptRef.current = null
        clearError()
        setMessages(msgs)
      },
      addToolOutput: params => Promise.resolve(addToolOutput(params)),
      messages,
      status,
      error: chatError,
    }),
    [
      workspaceId,
      sdkSendMessage,
      regenerate,
      stop,
      settledFetch,
      setMessages,
      clearError,
      addToolOutput,
      messages,
      status,
      chatError,
      invalidateGeneration,
      registrationOwner,
    ]
  )
  useEffect(() => {
    runtimeApiRef.current = runtimeApi
  }, [runtimeApi])

  useEffect(() => {
    if (!workspaceId) return
    const owner = registrationOwner
    registerModuleAIChatRuntime(workspaceId, owner, runtimeApi)
    return () => unregisterModuleAIChatRuntime(workspaceId, owner)
  }, [workspaceId, runtimeApi, registrationOwner])
  // 处理 chatError: 中断残留 tool part + 插入错误 part + 恢复输入框 (错误写入的唯一路径).
  // AI SDK streamText 的 maxRetries: 2 已覆盖网络层重试. 每个错误只处理一次, 且只处理
  // 产生该错误的 runtime generation；加载其它 transcript 会清除 SDK error 并使旧 attempt 失效.
  useEffect(() => {
    if (!chatError || handledErrorRef.current === chatError) return
    const attempt = errorAttemptRef.current
    if (!attempt || attempt.error !== chatError || attempt.runtime !== runtime) return
    const clientRuntimeError = isClientRuntimeError(chatError)
    const timer = setTimeout(() => {
      if (
        handledErrorRef.current === chatError ||
        attempt.runtime.generation !== attempt.generation
      )
        return
      const latest = runtimeApiRef.current
      if (!latest) return
      const currentMessages = latest.messages
      if (getAttemptKey(currentMessages, workspaceId) !== attempt.attemptKey) return

      handledErrorRef.current = chatError
      const store = useAIChatV2Store.getState()
      // 流被错误打断时, 末条 assistant 的 tool part 停在 input-*,
      // isChatProcessing 会永久为 true (loading 卡死) 且 SDK 拒绝下一轮发送.
      const interrupted = interruptTrailingPendingToolParts(
        currentMessages,
        TOOL_EXECUTION_INTERRUPTED
      )
      if (interrupted) latest.setMessages(interrupted)
      // React 自身的不变量错误不作为 provider 错误展示, 但上面的 tool part
      // 清理仍然要做, 否则界面停在 loading.
      if (clientRuntimeError) return
      const code = classifyChatError(chatError)
      if (shouldSuppressOverflowError(code, attempt.attemptKey)) return
      if (attempt.attemptKey) {
        clearOverflowRecovery(attempt.attemptKey)
        clearPreparedTurn(attempt.attemptKey)
      }
      addErrorToMessages(interrupted ?? currentMessages, chatError, next =>
        latest.setMessages(next)
      )
      if (store.lastSentInput && !store.inputMessage) store.restoreInput()
    }, 200)
    return () => clearTimeout(timer)
  }, [chatError, runtime, workspaceId])

  // token 使用同步

  useTokenUsageReporter(messages, workspaceId)
  useConversationLifecycle({ workspaceId, messages, status })

  useEffect(() => {
    return () => {
      resetOverflowRecovery()
      clearPreparedTurn()
    }
  }, [])

  return runtimeApi
}
