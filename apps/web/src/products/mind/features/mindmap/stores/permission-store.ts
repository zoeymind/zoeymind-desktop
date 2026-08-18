/**
 * 权限 store —— 桌面端 stub。
 *
 * 云版本承载"当前用户对本 mindmap 是否可编辑 / 角色 / 是否 owner"等 ACL 状态。
 * 桌面端本地文件恒可编辑，仅保留同样的 hook 表面让老 UI（FormatPanel/StatusBar/
 * TopBar/useContextMenu/useCanvasManager）不用改 import 即可继续跑。
 */

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

/** 与 zustand 一致的 hook 表面：`usePermissionStore()` / `usePermissionStore(sel)`。 */
export function usePermissionStore<T = PermissionState>(selector?: (s: PermissionState) => T): T {
  return (selector ? selector(STATE) : STATE) as T
}
