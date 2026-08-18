/** 权限 store —— 桌面端本地文件恒可编辑。 */

export type MindmapRole = 'OWNER' | 'EDITOR' | 'VIEWER'

interface PermissionState {
  role: MindmapRole
  isOwner: true
  canEdit: true
  hasPermission: true
  checkCompleted: true
}

const STATE: PermissionState = {
  role: 'OWNER',
  isOwner: true,
  canEdit: true,
  hasPermission: true,
  checkCompleted: true
}

export function usePermissionStore<T = PermissionState>(selector?: (s: PermissionState) => T): T {
  return (selector ? selector(STATE) : STATE) as T
}
