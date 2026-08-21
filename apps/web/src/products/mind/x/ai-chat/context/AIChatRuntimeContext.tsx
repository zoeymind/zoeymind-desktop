// @ts-nocheck — desktop mirror of cloud AI chat; runtime bridged via bridge.tsx
/**
 * AIChatRuntimeContext — 把 useChat 的 SDK 句柄 + 响应式状态暴露给消费组件和派生 hook.
 *
 * 用法 (Provider 由 AIChatProvider 组件在 MindMapCanvas 顶层挂载):
 *   <AIChatRuntimeProvider runtime={runtimeApi}>
 *     <MindMapCanvas 内容 />
 *   </AIChatRuntimeProvider>
 *
 *   function Foo() {
 *     const { sendMessage, messages, status } = useAIChatRuntime()
 *   }
 *
 * 设计要点:
 *   - 动作函数经 ref 稳定 (identity 抖动不触发重渲染)
 *   - messages / status / error 是数据, 必须驱动重渲染 — context value 的 useMemo
 *     以它们为 dep, 每次流式更新都换新 value, 订阅组件跟着更新.
 *     NEVER 把数据藏进 ref+getter: value identity 不变 = 订阅者永不重渲染 = UI 冻结.
 *   - getIdMapper / shortenId 是延迟访问, 调用时才读 MindmapContextManager.idMapper
 */

import {
  createContext,
  useContext,
  useMemo,
  useRef,
  type ReactNode,
  type ReactElement,
} from "react"
import type { UIMessage } from "@ai-sdk/react"
import type { AddToolOutputParams, SendMessageParams } from "../../ai-chat/types"
import type { SessionIdMapper } from "../../ai-chat/tools/session-id-mapper"

export interface AIChatRuntime {
  /** useChat 的 sendMessage, 入参为 ai-sdk SendMessageParams */
  sendMessage: (params: SendMessageParams) => void
  regenerate: (options?: { body?: Record<string, unknown> }) => void
  /** useChat 的 stop, 取消当前流 */
  stop: () => void
  /** useChat 的 setMessages, 覆盖整条消息列表 */
  setMessages: (messages: UIMessage[]) => void
  /** useChat 的 addToolOutput, 让前端工具结果回传给 SDK */
  addToolOutput: (params: AddToolOutputParams) => Promise<void>
  /** 拿当前 MindmapContextManager 的 idMapper 实例 (没初始化时返回 null) */
  getIdMapper: () => SessionIdMapper | null
  /** UUID → 短 ID. 没 mapper 时透传原值. type 暂未使用, 保留兼容旧签名. */
  shortenId: (uuid: string, type: "module" | "case") => string
  /** useChat 的 messages — AI SDK 单一事实源 (响应式, 组件直接读) */
  messages: UIMessage[]
  /** useChat 的 status — submitted | streaming | ready | error (响应式) */
  status: string
  /** useChat 的 error — 错误对象或 undefined (响应式) */
  error: Error | undefined
}

/** 内部使用: 动作函数用 ref 包一层, 让函数 identity 抖动不会触发 value 重建 */
interface AIChatRuntimeActionRefs {
  sendMessage: AIChatRuntime["sendMessage"] | null
  regenerate: AIChatRuntime["regenerate"] | null
  stop: AIChatRuntime["stop"] | null
  setMessages: AIChatRuntime["setMessages"] | null
  addToolOutput: AIChatRuntime["addToolOutput"] | null
  getIdMapper: AIChatRuntime["getIdMapper"] | null
  shortenId: AIChatRuntime["shortenId"] | null
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
    getIdMapper: null,
    shortenId: null,
  })

  // 每次渲染刷新动作引用
  actionRefs.current.sendMessage = runtime.sendMessage
  actionRefs.current.regenerate = runtime.regenerate
  actionRefs.current.stop = runtime.stop
  actionRefs.current.setMessages = runtime.setMessages
  actionRefs.current.addToolOutput = runtime.addToolOutput
  actionRefs.current.getIdMapper = runtime.getIdMapper
  actionRefs.current.shortenId = runtime.shortenId

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
      getIdMapper: () => actionRefs.current.getIdMapper?.() ?? null,
      shortenId: (uuid, type) => actionRefs.current.shortenId?.(uuid, type) ?? uuid,
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
