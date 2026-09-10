import { createContext, useContext } from "react"
import type { UIMessage } from "@ai-sdk/react"
import type { AddToolOutputParams, SendMessageParams } from "../../ai-chat/types"

export interface AIChatRuntime {
  workspaceId: string | undefined
  instanceId: symbol
  sendMessage: (params: SendMessageParams) => Promise<void>
  regenerate: (options?: { body?: Record<string, unknown> }) => Promise<void>
  stop: () => Promise<void>
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

const moduleRuntimes = new Map<string, { owner: symbol; runtime: AIChatRuntime }>()

export function registerModuleAIChatRuntime(
  workspaceId: string,
  owner: symbol,
  runtime: AIChatRuntime
): void {
  moduleRuntimes.set(workspaceId, { owner, runtime })
}

export function unregisterModuleAIChatRuntime(workspaceId: string, owner: symbol): void {
  const registration = moduleRuntimes.get(workspaceId)
  if (registration?.owner === owner) moduleRuntimes.delete(workspaceId)
}

export function getModuleAIChatRuntime(workspaceId: string | undefined): AIChatRuntime | null {
  return workspaceId ? (moduleRuntimes.get(workspaceId)?.runtime ?? null) : null
}
