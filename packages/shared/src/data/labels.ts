/**
 * 所有枚举的显示文案/颜色，**所有 UI 显示都走这里**。
 *
 * 类型：使用 `Record<string, string>` 以便消费端可以直接用 string 索引
 * （API 返回值通常是 string 类型）。源头通过具名常量（如 `OrganizationRoles.OWNER`）
 * 作为 key 编写，保证单点修改安全。
 *
 * 任何业务代码里写 `roleLabels: Record<string, string> = { OWNER: '...' }`
 * 都是 anti-pattern —— import 这里的常量。
 */

import { OrganizationRoles } from '../schemas/organization'
import { MindmapRoles } from '../schemas/mindmap'
import { BuiltinProjectRoles } from './project-permissions'

// ─── 组织角色 ──────────────────────────────────
export const ORG_ROLE_LABELS: Record<string, string> = {
  [OrganizationRoles.OWNER]: '所有者',
  [OrganizationRoles.ADMIN]: '管理员',
  [OrganizationRoles.MEMBER]: '成员',
  [OrganizationRoles.GUEST]: '访客'
}

export const ORG_ROLE_COLORS: Record<string, string> = {
  [OrganizationRoles.OWNER]: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  [OrganizationRoles.ADMIN]: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  [OrganizationRoles.MEMBER]: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
  [OrganizationRoles.GUEST]: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
}

// ─── 项目角色 ──────────────────────────────────
export const PROJECT_ROLE_LABELS: Record<string, string> = {
  [BuiltinProjectRoles.ADMIN]: '管理员',
  [BuiltinProjectRoles.PRODUCT]: '产品',
  [BuiltinProjectRoles.DEVELOPER]: '开发',
  [BuiltinProjectRoles.TESTER]: '测试',
  [BuiltinProjectRoles.MEMBER]: '成员'
}

/**
 * 从 member 的角色字段派生用于头像 hover 名片的 role badge 文案。
 * 项目角色优先（业务上下文更强）；未加入该项目回退组织角色。
 */
export function roleBadgeFor(input: {
  projectRole?: string | null
  orgRole?: string | null
}): string | undefined {
  if (input.projectRole) return PROJECT_ROLE_LABELS[input.projectRole] ?? input.projectRole
  if (input.orgRole) return ORG_ROLE_LABELS[input.orgRole] ?? input.orgRole
  return undefined
}

// ─── 思维导图协作角色 ─────────────────────────
export const MINDMAP_ROLE_LABELS: Record<string, string> = {
  [MindmapRoles.VIEWER]: '只读',
  [MindmapRoles.EDITOR]: '可编辑',
  [MindmapRoles.OWNER]: '拥有者'
}
