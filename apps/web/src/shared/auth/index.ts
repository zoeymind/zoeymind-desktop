/**
 * 桌面端 auth shim —— 零登录/零账号。
 *
 * mind features 少量地方仍 import 这里的 hook/组件（authClient 判会话、
 * UserAvatar 展示、hubSettingsUrl 拼跳转）；桌面端全部退化为 no-op：
 *   - `useAuth()` 恒 authenticated=true（避免登录闸），无 user 字段
 *   - `authClient.useSession()` 返回 null
 *   - `UserAvatar` / `WorkspaceAvatar` / `SessionItem` 是 null 组件
 *   - `hubSettingsUrl` 返回 "#" —— call site 应该被主动删掉
 *
 * 目标是让编译通过，不是让运行时展示"账号信息"；用户已明确要求
 * "桌面端不需要用户相关内容，个人中心去掉"。
 */
import type { ComponentType, ReactNode } from "react"

export interface UserAvatarProps {
  size?: UserAvatarSize
  user?: unknown
  className?: string
  children?: ReactNode
}

export type UserAvatarSize = "xs" | "sm" | "md" | "lg" | "xl"

/** 桌面端不显示用户头像 —— 直接 null，UI 会自然折叠。 */
export const UserAvatar: ComponentType<UserAvatarProps> = () => null

/** 组织头像同理，桌面端无多组织。 */
export const WorkspaceAvatar: ComponentType<Record<string, unknown>> = () => null

/** 个人中心里的会话列表条目，桌面端不展示。 */
export const SessionItem: ComponentType<Record<string, unknown>> = () => null

/** hub 设置页跳转 URL：桌面端没有 hub，返回锚点让链接不跳转。 */
export function hubSettingsUrl(section?: string): string {
  void section
  return "#"
}

interface UseAuthResult {
  isAuthenticated: true
  isLoading: false
  session: null
}

export function useAuth(): UseAuthResult {
  return { isAuthenticated: true, isLoading: false, session: null }
}

interface AccountUI {
  openAccountMenu: () => void
  closeAccountMenu: () => void
}

const NOOP_ACCOUNT_UI: AccountUI = {
  openAccountMenu: () => undefined,
  closeAccountMenu: () => undefined,
}

export function useAccountUI(): AccountUI {
  return NOOP_ACCOUNT_UI
}

interface AuthClient {
  useSession(): { data: null; isPending: false }
  signIn: { social: () => Promise<void> }
  signOut: () => Promise<void>
}

export const authClient: AuthClient = {
  useSession: () => ({ data: null, isPending: false }),
  signIn: { social: async () => undefined },
  signOut: async () => undefined,
}
