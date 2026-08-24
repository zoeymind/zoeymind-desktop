import { createContext, useContext } from "react"
import { useSaveFlow, type SaveFlow } from "./save-flow"

export const SaveFlowContext = createContext<SaveFlow | null>(null)

export function useSaveFlowContext(): SaveFlow {
  const context = useContext(SaveFlowContext)
  if (!context) throw new Error("useSaveFlowContext must be used inside <SaveFlowProvider>")
  return context
}

export function useOptionalSaveFlow(fallbackProjectId: string | null): SaveFlow {
  const context = useContext(SaveFlowContext)
  const fallback = useSaveFlow(context ? null : fallbackProjectId)
  return context ?? fallback
}
