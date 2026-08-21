/**
 * AIChatRuntimeContext — exposes the SDK handles and reactive chat state.
 */

import {
  createContext,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  type ReactNode,
  type ReactElement,
} from "react"
import type { AddToolOutputParams, SendMessageParams } from "../../ai-chat/types"
import type { UIMessage } from "@ai-sdk/react"

export interface AIChatRuntime {
  sendMessage: (params: SendMessageParams) => void
  regenerate: (options?: { body?: Record<string, unknown> }) => void
  stop: () => void
  setMessages: (messages: UIMessage[]) => void
  addToolOutput: (params: AddToolOutputParams) => Promise<void>
  messages: UIMessage[]
  status: string
  error: Error | undefined
}

interface AIChatRuntimeActionRefs {
  sendMessage: AIChatRuntime["sendMessage"] | null
  regenerate: AIChatRuntime["regenerate"] | null
  stop: AIChatRuntime["stop"] | null
  setMessages: AIChatRuntime["setMessages"] | null
  addToolOutput: AIChatRuntime["addToolOutput"] | null
}

const AIChatRuntimeContext = createContext<AIChatRuntime | null>(null)

interface AIChatRuntimeProviderProps {
  /** 由 useAIChat 计算好后传入; 必须稳定 (内部用 refs 解耦 identity) */
  runtime: AIChatRuntime
  children: ReactNode
}

/**
 * Provider: 动作经 refs 稳定; messages/status/error 作为 useMemo dep,
 * 流式更新时 value 换新引用, 订阅组件正常重渲染.
 */
export function AIChatRuntimeProvider({
  runtime,
  children,
}: AIChatRuntimeProviderProps): ReactElement {
  const actionRefs = useRef<AIChatRuntimeActionRefs>({
    sendMessage: null,
    regenerate: null,
    stop: null,
    setMessages: null,
    addToolOutput: null,
  })

  useLayoutEffect(() => {
    actionRefs.current = {
      sendMessage: runtime.sendMessage,
      regenerate: runtime.regenerate,
      stop: runtime.stop,
      setMessages: runtime.setMessages,
      addToolOutput: runtime.addToolOutput,
    }
  }, [
    runtime.addToolOutput,
    runtime.regenerate,
    runtime.sendMessage,
    runtime.setMessages,
    runtime.stop,
  ])

  const { messages, status, error } = runtime

  const value = useMemo<AIChatRuntime>(
    () => ({
      sendMessage: params => {
        actionRefs.current.sendMessage?.(params)
      },
      regenerate: options => {
        actionRefs.current.regenerate?.(options)
      },
      stop: () => {
        actionRefs.current.stop?.()
      },
      setMessages: msgs => {
        actionRefs.current.setMessages?.(msgs)
      },
      addToolOutput: params => actionRefs.current.addToolOutput?.(params) ?? Promise.resolve(),
      messages,
      status,
      error,
    }),
    [messages, status, error]
  )

  return <AIChatRuntimeContext.Provider value={value}>{children}</AIChatRuntimeContext.Provider>
}

/**
 * 在组件 / 派生 hook 里拿当前 AI 聊天的运行时. 必须在 AIChatRuntimeProvider 内调用,
 * 否则抛 — 漏 Provider 是程序员错误, 不应当作"运行时无 mindMap"那样默默吃掉.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useAIChatRuntime(): AIChatRuntime {
  const value = useContext(AIChatRuntimeContext)
  if (!value) {
    throw new Error("useAIChatRuntime must be called inside <AIChatRuntimeProvider>")
  }
  return value
}

/**
 * 非组件上下文 (store actions / module-level helpers) 也需要拿到 runtime,
 * 这里提供一个 module-level singleton, 由 useAIChat 在 mount 时填充.
 * 仅用于 Zustand store action 这种没法直接 useContext 的地方.
 */
let moduleRuntime: AIChatRuntime | null = null

// eslint-disable-next-line react-refresh/only-export-components
export function setModuleAIChatRuntime(runtime: AIChatRuntime | null): void {
  moduleRuntime = runtime
}

// eslint-disable-next-line react-refresh/only-export-components
export function getModuleAIChatRuntime(): AIChatRuntime | null {
  return moduleRuntime
}
