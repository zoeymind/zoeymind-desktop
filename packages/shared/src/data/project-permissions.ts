/**
 * 项目级 RBAC 权限 statement 矩阵 —— 前后端单一事实源（ADR 0003）。
 *
 * - 权限 statement 形如 `资源:动作`（如 `bug:close`）。
 * - 内置 4 角色（测试/开发/PM/访客）的默认权限矩阵在此定义，供：
 *   - 后端 seed organizationRole 表（#89）
 *   - 后端 ProjectPermissionService.can 判定（#91）
 *   - 前端 usePermission / <Can> 门控（#92）
 *
 * 本文件是纯常量，无 zod / better-auth 依赖 —— 保持 @zoeymind/shared 处于最底层。
 * 角色名/权限位改动只改这一处，编译器全量检查引用。
 *
 * 注：缺陷（bug）模块（#81）尚未落地，`bug:*` 为预定义权限位，
 * 待缺陷模块实现时前端 <Can> 门控即可直接挂载，无需回改矩阵。
 */

// ─── 资源 ──────────────────────────────────────
export const PROJECT_RESOURCES = [
  'bug', // 缺陷（#81 落地后生效）
  'testCase', // 测试用例
  'testPlan', // 测试计划
  'testReport', // 测试报告
  'version', // 软件版本
  'member', // 项目成员
  'role', // 项目角色
  'workspace' // 项目空间本体（编辑设置/删除/管理成员的粗粒度门控，mind/kb 共用）
] as const

export type ProjectResource = (typeof PROJECT_RESOURCES)[number]

// ─── 权限 statement（资源:动作）─────────────────
export const PROJECT_PERMISSIONS = [
  // 缺陷：状态流转按角色门控（开发只能处理中/已解决，测试才能关闭/打回）
  'bug:create',
  'bug:read',
  'bug:update',
  'bug:delete',
  'bug:resolve', // 标记已解决（开发）
  'bug:close', // 关闭（测试）
  'bug:reopen', // 打回重开（测试）
  'bug:manageFields', // 字段管理（新增/改/删自定义字段、值库，#102；仅 PM/管理员）
  'bug:comment', // 缺陷评论：发/改/删自己评论 + 加/取消 reaction（#104 评论子系统）
  // 测试用例
  'testCase:create',
  'testCase:read',
  'testCase:update',
  'testCase:delete',
  // 测试计划
  'testPlan:create',
  'testPlan:read',
  'testPlan:update',
  'testPlan:delete',
  'testPlan:execute',
  // 测试报告
  'testReport:read',
  'testReport:publish',
  // 软件版本
  'version:create',
  'version:read',
  'version:update',
  'version:delete',
  // 项目成员
  'member:read',
  'member:invite',
  'member:remove',
  'member:assignRole',
  'role:read',
  'role:manage',
  // 项目空间本体（粗粒度门控，mind/kb 共用；testProject 域旧 view/edit 映射到此）
  'workspace:read', // = 旧 view
  'workspace:update', // = 旧 edit（编辑内容/设置）
  'workspace:manageMembers', // = 旧 admin（管理成员）
  'workspace:delete' // = 旧 owner（删除项目）
] as const

export type ProjectPermission = (typeof PROJECT_PERMISSIONS)[number]

// ─── 内置角色 ──────────────────────────────────
export const BuiltinProjectRoles = {
  ADMIN: 'ADMIN', // 管理员（项目创建者默认，含成员/角色/删项目全权）
  PRODUCT: 'PRODUCT', // 产品
  DEVELOPER: 'DEVELOPER', // 开发
  TESTER: 'TESTER', // 测试
  MEMBER: 'MEMBER' // 成员（默认，只读）
} as const

export type BuiltinProjectRole = (typeof BuiltinProjectRoles)[keyof typeof BuiltinProjectRoles]

// 全部只读权限（成员 = 全只读）
const READ_PERMISSIONS = PROJECT_PERMISSIONS.filter(p => p.endsWith(':read'))

// 管理员：全集（含成员/角色管理 + 删项目）。项目创建者默认此角色。
const ADMIN_PERMISSIONS: ProjectPermission[] = [...PROJECT_PERMISSIONS]

// 产品：缺陷全权（含字段管理）+ 用例/计划/报告/版本读写，不管成员/角色/删项目
const PRODUCT_PERMISSIONS: ProjectPermission[] = [
  ...READ_PERMISSIONS,
  'bug:create',
  'bug:update',
  'bug:delete',
  'bug:close',
  'bug:reopen',
  'bug:manageFields',
  'bug:comment',
  'testCase:create',
  'testCase:update',
  'testCase:delete',
  'testPlan:create',
  'testPlan:update',
  'testPlan:delete',
  'testReport:publish',
  'version:create',
  'version:update',
  'version:delete',
  'workspace:update'
]

// 测试：用例/计划/报告/版本全权 + 缺陷可关闭/打回，不管成员/角色
const TESTER_PERMISSIONS: ProjectPermission[] = [
  ...READ_PERMISSIONS,
  'bug:create',
  'bug:update',
  'bug:delete',
  'bug:close',
  'bug:reopen',
  'bug:comment',
  'testCase:create',
  'testCase:update',
  'testCase:delete',
  'testPlan:create',
  'testPlan:update',
  'testPlan:delete',
  'testPlan:execute',
  'testReport:publish',
  'version:create',
  'version:update',
  'version:delete',
  'workspace:update'
]

// 开发：缺陷只能处理中/已解决，其余只读
const DEVELOPER_PERMISSIONS: ProjectPermission[] = [
  ...READ_PERMISSIONS,
  'bug:create',
  'bug:update',
  'bug:resolve',
  'bug:comment'
]

// 成员：只读 + 评论。
//
// "只读" 约束的是改变事实的动作（缺陷状态、用例内容、成员构成），评论是表达看法，
// 性质不同：能看见缺陷就应当能参与讨论，否则成员在协作工具里无法沟通。对齐
// Jira / GitHub —— 其只读级角色同样可评论。删改仍限本人评论（路由层另有校验）。
const MEMBER_PERMISSIONS: ProjectPermission[] = [...READ_PERMISSIONS, 'bug:comment']

/**
 * 内置角色 → 权限位数组。判定与列表共用同一份。
 */
export const BUILTIN_ROLE_PERMISSIONS: Record<BuiltinProjectRole, ProjectPermission[]> = {
  [BuiltinProjectRoles.ADMIN]: ADMIN_PERMISSIONS,
  [BuiltinProjectRoles.PRODUCT]: PRODUCT_PERMISSIONS,
  [BuiltinProjectRoles.DEVELOPER]: DEVELOPER_PERMISSIONS,
  [BuiltinProjectRoles.TESTER]: TESTER_PERMISSIONS,
  [BuiltinProjectRoles.MEMBER]: MEMBER_PERMISSIONS
}

/**
 * 判定内置角色是否拥有某权限。未知角色一律无权。
 * 运行时自定义角色（dynamicAccessControl）不走这里，走 ProjectPermissionService 查 DB 矩阵。
 */
export function roleHasPermission(
  role: BuiltinProjectRole,
  permission: ProjectPermission
): boolean {
  const perms = BUILTIN_ROLE_PERMISSIONS[role]
  if (!perms) return false
  return perms.includes(permission)
}
