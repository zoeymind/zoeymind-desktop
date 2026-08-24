import { createContext, useContext } from "react"
import type { UIMessage } from "@ai-sdk/react"
import type { AddToolOutputParams, SendMessageParams } from "../../ai-chat/types"

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

export const AIChatRuntimeContext = createContext<AIChatRuntime | null>(null)

export function useAIChatRuntime(): AIChatRuntime {
  const value = useContext(AIChatRuntimeContext)
  if (!value) throw new Error("useAIChatRuntime must be called inside <AIChatRuntimeProvider>")
  return value
}

let moduleRuntime: AIChatRuntime | null = null

export function setModuleAIChatRuntime(runtime: AIChatRuntime | null): void {
  moduleRuntime = runtime
}

export function getModuleAIChatRuntime(): AIChatRuntime | null {
  return moduleRuntime
}
