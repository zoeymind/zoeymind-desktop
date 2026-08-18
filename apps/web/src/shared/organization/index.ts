/**
 * organization shim —— 桌面端不做多租户/工作区切换。
 * 保留最少 API 表面让 ProjectsSidebar / MoveDialog 等文件 import 不炸。
 */
import type { ComponentType } from 'react'

export interface LocalWorkspace {
  id: string
  name: string
}

export interface WorkspaceOption {
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

const NULL_COMPONENT: ComponentType<Record<string, unknown>> = () => null
export const AppBrandBar = NULL_COMPONENT
export const CreateProjectDialog = NULL_COMPONENT
export const ProjectSettingsDialog = NULL_COMPONENT
