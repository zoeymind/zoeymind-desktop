/**
 * organization shim —— 桌面端不做多租户/工作区切换。
 *
 * 仅保留一个稳定的"本地工作区"占位，让 `MoveDialog` 之类 `useCurrentWorkspace()`
 * 的取用不炸。桌面端没有真正的 workspace 概念，UI 应把 workspace 选择器彻底删掉。
 */

export interface LocalWorkspace {
  id: string
  name: string
}

const LOCAL_WORKSPACE: LocalWorkspace = { id: 'local', name: 'Local' }

interface UseCurrentWorkspaceResult {
  workspaceId: string
  list: LocalWorkspace[]
  isLoading: false
  setWorkspace: (id: string) => void
  canCreate: false
  refetch: () => Promise<void>
}

export function useCurrentWorkspace(
  _orgId: string | null,
  _role?: string
): UseCurrentWorkspaceResult {
  return {
    workspaceId: LOCAL_WORKSPACE.id,
    list: [LOCAL_WORKSPACE],
    isLoading: false,
    setWorkspace: () => undefined,
    canCreate: false,
    refetch: async () => undefined
  }
}
