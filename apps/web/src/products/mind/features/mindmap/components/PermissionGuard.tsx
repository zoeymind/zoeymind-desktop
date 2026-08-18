/** 权限守卫 —— 桌面端直通。 */
import type { ReactNode } from 'react'
export function PermissionGuard({ children }: { children: ReactNode }): ReactNode {
  return children
}
export default PermissionGuard
