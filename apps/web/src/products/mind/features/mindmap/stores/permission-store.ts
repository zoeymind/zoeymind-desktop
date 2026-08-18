import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { logger } from '@zoeymind/logger'
import { trpcClient } from '@/shared/app-shared'
import { MindmapRoles, canWriteMindmap, type MindmapRole } from '@zoeymind/shared'
import { i18next } from '@zoeymind/i18n'

export interface DeniedCardInfo {
  id: string
  title: string
  creator: { id: string; name: string | null; email: string | null; avatar: string | null }
  workspace: { id: string; name: string }
}

export interface PermissionState {
  hasPermission: boolean
  isOwner: boolean
  role: MindmapRole | undefined
  loading: boolean
  checkCompleted: boolean // 权限检查是否完成
  error: string | undefined
  /** 无权时是否可申请 (requester 是所属 org 成员). false → 前端 404 掩盖. */
  requestable: boolean
  /** requestable=true 时的卡片信息 (项目名 / 创建者); requestable=false 保持 null. */
  deniedCard: DeniedCardInfo | null
}

interface PermissionStore {
  // 权限状态
  hasPermission: boolean
  isOwner: boolean
  role: MindmapRole | undefined
  loading: boolean
  checkCompleted: boolean
  error: string | undefined
  requestable: boolean
  deniedCard: DeniedCardInfo | null

  // 当前检查的项目信息
  currentProjectId: string | undefined
  cloudMode: boolean

  // Actions
  setPermissionState: (state: Partial<PermissionState>) => void
  setProjectContext: (workspaceId: string | null, cloudMode: boolean) => void

  // 权限检查方法
  checkPermission: (workspaceId: string, action?: 'read' | 'write' | 'delete') => Promise<boolean>
  checkReadPermission: (workspaceId: string) => Promise<boolean>
  checkWritePermission: (workspaceId: string) => Promise<boolean>
  checkDeletePermission: (workspaceId: string) => Promise<boolean>

  // 便捷的权限判断
  canEdit: boolean
  canDelete: boolean
  canManagePermissions: boolean

  // 重置权限
  resetPermissions: () => void

  // 设置默认权限（用于非云模式或owner）
  setOwnerPermissions: (role?: MindmapRole) => void
}

export const usePermissionStore = create<PermissionStore>()(
  devtools(
    (set, get) => ({
      // Initial state - 采用默认拒绝策略
      hasPermission: false,
      isOwner: false,
      role: undefined,
      loading: false,
      checkCompleted: false,
      error: undefined,
      requestable: false,
      deniedCard: null,
      currentProjectId: undefined,
      cloudMode: false,

      // Actions
      setPermissionState: state => {
        set(prev => {
          const newState = { ...prev, ...state }
          newState.canEdit =
            newState.hasPermission && (newState.isOwner || canWriteMindmap(newState.role ?? null))
          newState.canDelete = newState.hasPermission && newState.isOwner
          newState.canManagePermissions = newState.hasPermission && newState.isOwner
          return newState
        })
      },

      setProjectContext: (workspaceId, cloudMode) => {
        set({ currentProjectId: workspaceId || undefined, cloudMode })
      },

      checkPermission: async (workspaceId, action = 'read') => {
        const { cloudMode } = get()

        // 非云模式直接返回owner权限
        if (!cloudMode) {
          set({
            hasPermission: true,
            isOwner: true,
            role: MindmapRoles.OWNER,
            loading: false,
            checkCompleted: true,
            error: undefined,
            requestable: false,
            deniedCard: null,
            canEdit: true,
            canDelete: true,
            canManagePermissions: true
          })
          return true
        }

        set({ loading: true, error: undefined })

        try {
          const result = await trpcClient.mindmap.permission.check.query({
            mindmapId: workspaceId,
            action
          })

          const role = result.role || undefined
          const requestable =
            'requestable' in result && typeof result.requestable === 'boolean'
              ? result.requestable
              : false
          const deniedCard =
            'mindmap' in result && result.mindmap && typeof result.mindmap === 'object'
              ? (result.mindmap as DeniedCardInfo)
              : null
          const newState = {
            hasPermission: result.hasPermission,
            isOwner: result.isOwner,
            role,
            loading: false,
            checkCompleted: true,
            error: result.success
              ? undefined
              : 'error' in result
                ? result.error || undefined
                : undefined,
            requestable,
            deniedCard,
            canEdit: result.hasPermission && (result.isOwner || canWriteMindmap(role ?? null)),
            canDelete: result.hasPermission && result.isOwner,
            canManagePermissions: result.hasPermission && result.isOwner
          }

          set(newState)
          return result.hasPermission
        } catch (error) {
          logger.error('PermissionStore: 权限检查失败', error)
          const errorMessage =
            error instanceof Error
              ? error.message
              : i18next.t('mindmap.toast.permissionCheckFailed')

          set({
            hasPermission: false,
            isOwner: false,
            role: undefined,
            loading: false,
            checkCompleted: true,
            error: errorMessage,
            requestable: false,
            deniedCard: null,
            canEdit: false,
            canDelete: false,
            canManagePermissions: false
          })

          return false
        }
      },

      checkReadPermission: async workspaceId => {
        return get().checkPermission(workspaceId, 'read')
      },

      checkWritePermission: async workspaceId => {
        return get().checkPermission(workspaceId, 'write')
      },

      checkDeletePermission: async workspaceId => {
        return get().checkPermission(workspaceId, 'delete')
      },

      resetPermissions: () => {
        set({
          hasPermission: false,
          isOwner: false,
          role: undefined,
          loading: false,
          checkCompleted: false,
          error: undefined,
          requestable: false,
          deniedCard: null,
          currentProjectId: undefined,
          cloudMode: false,
          canEdit: false,
          canDelete: false,
          canManagePermissions: false
        })
      },

      setOwnerPermissions: role => {
        const r = role ?? MindmapRoles.OWNER
        const writable = canWriteMindmap(r)

        set({
          hasPermission: true,
          isOwner: true,
          role: r,
          loading: false,
          checkCompleted: true,
          error: undefined,
          requestable: false,
          deniedCard: null,
          canEdit: writable,
          canDelete: writable,
          canManagePermissions: writable
        })
      },

      // 计算属性 - 在每次状态更新时重新计算
      canEdit: false,
      canDelete: false,
      canManagePermissions: false
    }),
    {
      name: 'permission-store'
    }
  )
)
