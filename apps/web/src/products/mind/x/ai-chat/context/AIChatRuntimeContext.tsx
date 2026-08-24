import { useLayoutEffect, useMemo, useRef, type ReactNode, type ReactElement } from "react"
import { AIChatRuntimeContext } from "./ai-chat-runtime"
import type { AIChatRuntime } from "./ai-chat-runtime"

interface AIChatRuntimeActionRefs {
  sendMessage: AIChatRuntime["sendMessage"] | null
  regenerate: AIChatRuntime["regenerate"] | null
  stop: AIChatRuntime["stop"] | null
  setMessages: AIChatRuntime["setMessages"] | null
  addToolOutput: AIChatRuntime["addToolOutput"] | null
}

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
