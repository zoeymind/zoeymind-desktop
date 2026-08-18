/**
 * SaveFlowContext —— useSaveFlow 的单例分发.
 *
 * 之前每个消费者 (useStorageManager / UnsavedGuard / Header 里的保存按钮)
 * 都各自 `useSaveFlow(id)`, 得到独立 stateRef. 结果:
 *   useStorageManager 里 registerBundleSource -> 只写到它自己的 ref
 *   UnsavedGuard 里 save() -> 读的是另一份 ref, state.source 恒为 null,
 *   `if (!state.source) return` 静默失败, 用户永远看不到 saveDialog.
 *
 * 现在: EditorShell 挂 `<SaveFlowProvider>` 里一次 useSaveFlow, 其它人
 * `useSaveFlowContext()` 拿同一个句柄.
 */
import { createContext, useContext, type ReactNode } from 'react'
import { useSaveFlow } from './save-flow'

type SaveFlow = ReturnType<typeof useSaveFlow>

const SaveFlowContext = createContext<SaveFlow | null>(null)

interface Props {
  projectId: string | null
  children: ReactNode
}

export function SaveFlowProvider({ projectId, children }: Props): React.JSX.Element {
  const flow = useSaveFlow(projectId)
  return <SaveFlowContext.Provider value={flow}>{children}</SaveFlowContext.Provider>
}

export function useSaveFlowContext(): SaveFlow {
  const ctx = useContext(SaveFlowContext)
  if (!ctx) {
    throw new Error('useSaveFlowContext must be used inside <SaveFlowProvider>')
  }
  return ctx
}

/** 允许在 Provider 之外读: 无 provider 时回退为独立 useSaveFlow(id). */
export function useOptionalSaveFlow(fallbackProjectId: string | null): SaveFlow {
  const ctx = useContext(SaveFlowContext)
  const fallback = useSaveFlow(ctx ? null : fallbackProjectId)
  return ctx ?? fallback
}
