import { z } from 'zod'

/**
 * 思维导图相关的 Zod Schema 定义
 */

// 创建思维导图的输入 Schema
//
// workspaceId 可选: 缺省 = null → 归属于"我的图"虚拟视图 (只 creator + 显式 permission 可读).
// 想让 WorkspaceMember 或 org 成员可读, 需先 setProject 到某 Project + setVisibility.
export const createMindmapSchema = z.object({
  title: z.string().min(1, '标题不能为空').max(100, '标题过长'),
  description: z.string().max(500, '描述过长').optional(),
  tags: z.array(z.string()).max(10, '标签数量过多').default([]),
  workspaceId: z.string().nullish()
})

// 获取项目列表的输入 Schema
// 列表输入 Schema
//
// workspaceId 语义:
//   - 未传:       跨 project (含 workspaceId=null 我的图) 全展示. 由 owner 过滤缩窄.
//   - 'null'/null: 显式过滤 workspaceId=null 的"我的图"
//   - 具体 id:     只返回该 Project 的 mindmap
//
// owner:
//   - 'me':    只看 createdBy=me 的 (等同飞书'我的文档')
//   - 'other': 只看非我创建的 (共享给我; 需配合 workspaceId 分组)
//   - 未传:    不按 owner 过滤
export const listMindmapsSchema = z.object({
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(200).default(10),
  search: z.string().optional(),
  folderId: z.string().cuid().optional(),
  workspaceId: z.union([z.string(), z.literal('null'), z.null()]).optional(),
  owner: z.enum(['me', 'other']).optional()
})

// 根据ID获取项目的输入 Schema
export const getMindmapByIdSchema = z.object({
  mindmapId: z.string().cuid('无效的项目ID')
})

// 删除项目的输入 Schema
export const deleteMindmapSchema = z.object({
  mindmapId: z.string().cuid('无效的项目ID')
})

// 更新项目元信息的输入 Schema
export const updateMindmapMetaSchema = z.object({
  mindmapId: z.string().cuid('无效的项目ID'),
  title: z.string().min(1, '标题不能为空').max(100, '标题过长').optional(),
  description: z.string().max(500, '描述过长').optional(),
  tags: z.array(z.string()).max(10, '标签数量过多').optional(),
  coverKey: z.string().optional(),
  nodeCount: z.number().min(0, '测试用例数量不能为负数').optional(),
  theme: z.string().optional(),
  isFavorite: z.boolean().optional(),
  /** 乐观锁：期望的 updatedAt 时间戳（ISO 8601），若提供则检查是否匹配 */
  expectedUpdatedAt: z.string().datetime().optional()
})

// 获取内容的输入 Schema
export const getMindmapContentSchema = z.object({
  mindmapId: z.string().cuid('无效的项目ID')
})

// ─── 文件夹（组织级，扁平一层） ───────────────────────────
export const listFoldersSchema = z.object({
  organizationId: z.string()
})
export type ListFoldersInput = z.infer<typeof listFoldersSchema>

export const createFolderSchema = z.object({
  organizationId: z.string(),
  name: z.string().min(1, '文件夹名不能为空').max(50, '文件夹名过长')
})
export type CreateFolderInput = z.infer<typeof createFolderSchema>

export const renameFolderSchema = z.object({
  folderId: z.string().cuid('无效的文件夹ID'),
  name: z.string().min(1, '文件夹名不能为空').max(50, '文件夹名过长')
})
export type RenameFolderInput = z.infer<typeof renameFolderSchema>

export const deleteFolderSchema = z.object({
  folderId: z.string().cuid('无效的文件夹ID'),
  // true 时把文件夹内的思维导图一并移入回收站；默认仅删文件夹（导图移到「全部导图」）
  deleteContents: z.boolean().optional().default(false)
})
export type DeleteFolderInput = z.infer<typeof deleteFolderSchema>

// ─── 移动 ───────────────────────────
// 移动到文件夹（folderId=null 表示移出文件夹）
export const moveMindmapToFolderSchema = z.object({
  mindmapId: z.string().cuid('无效的项目ID'),
  folderId: z.string().cuid('无效的文件夹ID').nullable()
})
export type MoveMindmapToFolderInput = z.infer<typeof moveMindmapToFolderSchema>

// 移动到其他项目空间 (workspace/project) — 同一组织内跨 workspace
export const moveMindmapToWorkspaceSchema = z.object({
  mindmapId: z.string().cuid('无效的项目ID'),
  workspaceId: z.string()
})
export type MoveMindmapToWorkspaceInput = z.infer<typeof moveMindmapToWorkspaceSchema>

// ─── 回收站（软删除） ───────────────────────────
export const listTrashSchema = z.object({
  organizationId: z.string()
})
export type ListTrashInput = z.infer<typeof listTrashSchema>

export const restoreMindmapSchema = z.object({
  mindmapId: z.string().cuid('无效的项目ID')
})
export type RestoreMindmapInput = z.infer<typeof restoreMindmapSchema>

export const purgeMindmapSchema = z.object({
  mindmapId: z.string().cuid('无效的项目ID')
})
export type PurgeMindmapInput = z.infer<typeof purgeMindmapSchema>

/**
 * 协作角色（Phase A 新增）。
 */

export const MindmapRoleSchema = z.enum(['VIEWER', 'EDITOR', 'OWNER'])
export const MindmapRoles = MindmapRoleSchema.enum
export type MindmapRole = z.infer<typeof MindmapRoleSchema>

/**
 * 可见性作用域 (飞书式逐 mindmap 作用域):
 * - PRIVATE:   默认, 仅创建者 + 显式 MindmapPermission
 * - WORKSPACE: 所属 Project 的 WorkspaceMember 可读
 * - ORG:       所属 org 全体成员可读
 * 对外公开继续走 ShareLink, 不进本枚举.
 */
export const MindmapVisibilitySchema = z.enum(['PRIVATE', 'WORKSPACE', 'ORG'])
export const MindmapVisibilities = MindmapVisibilitySchema.enum
export type MindmapVisibility = z.infer<typeof MindmapVisibilitySchema>

export const setMindmapVisibilitySchema = z.object({
  mindmapId: z.string().cuid('无效的项目ID'),
  visibility: MindmapVisibilitySchema
})
export type SetMindmapVisibilityInput = z.infer<typeof setMindmapVisibilitySchema>
// 创建文档协作邀请（项目级，不进组织）
export const createMindmapInvitationSchema = z.object({
  mindmapId: z.string().cuid('无效的项目ID'),
  email: z.string().trim().toLowerCase().email('邮箱格式不正确'),
  role: MindmapRoleSchema
})
export type CreateMindmapInvitationInput = z.infer<typeof createMindmapInvitationSchema>

// 接受文档协作邀请（通过 token）
export const acceptMindmapInvitationSchema = z.object({
  token: z.string().min(1)
})
export type AcceptMindmapInvitationInput = z.infer<typeof acceptMindmapInvitationSchema>

// 文档协作邀请预览（无需登录，通过 token）
export const mindmapInvitationPreviewSchema = z.object({
  token: z.string().min(1)
})
export type MindmapInvitationPreviewInput = z.infer<typeof mindmapInvitationPreviewSchema>

// 列出某文档的待接受邀请
export const listMindmapInvitationsSchema = z.object({
  mindmapId: z.string().cuid('无效的项目ID')
})
export type ListMindmapInvitationsInput = z.infer<typeof listMindmapInvitationsSchema>

// 撤销邀请
export const revokeMindmapInvitationSchema = z.object({
  mindmapId: z.string().cuid('无效的项目ID'),
  invitationId: z.string().cuid('无效的邀请ID')
})
export type RevokeMindmapInvitationInput = z.infer<typeof revokeMindmapInvitationSchema>

// 移除协作者
export const removeMindmapCollaboratorSchema = z.object({
  mindmapId: z.string().cuid('无效的项目ID'),
  userId: z.string().min(1)
})
export type RemoveMindmapCollaboratorInput = z.infer<typeof removeMindmapCollaboratorSchema>

// 更新协作者角色
export const updateMindmapCollaboratorRoleSchema = z.object({
  mindmapId: z.string().cuid('无效的项目ID'),
  userId: z.string().min(1),
  role: MindmapRoleSchema
})
export type UpdateMindmapCollaboratorRoleInput = z.infer<typeof updateMindmapCollaboratorRoleSchema>

/** 能否阅读 mindmap (任何 role 都能读) */
export function canReadMindmap(role: MindmapRole | null): boolean {
  return role !== null
}

/** 能否编辑 mindmap (EDITOR / OWNER 才能写) */
export function canWriteMindmap(role: MindmapRole | null): boolean {
  return role === 'EDITOR' || role === 'OWNER'
}

// 评论对所有有访问权的人开放（不再有独立的 COMMENTER 角色）；如需判断用 canReadMindmap。

// 发布到项目 / 取消发布 (workspaceId=null → 回到"我的图" 虚拟视图)
//
// 与 moveMindmapToWorkspaceSchema 区别:
//   - moveToProject: 强制传 workspaceId, 跨 workspace 转移 (要求目标 WorkspaceMember 非 VIEWER)
//   - setMindmapProject: 允许 null; 只用于 owner 在 ShareDialog 切换发布状态
export const setMindmapWorkspaceSchema = z.object({
  mindmapId: z.string().cuid('无效的项目ID'),
  workspaceId: z.string().nullable()
})
export type SetMindmapWorkspaceInput = z.infer<typeof setMindmapWorkspaceSchema>

// 合并的"发布"操作: 原子写 visibility + workspaceId (两者语义耦合, 分开写有一致性风险).
//
// UI 单一 Select 语义组合:
//   - 私有:         visibility=PRIVATE, workspaceId 保持原样
//   - 发布到项目 X: visibility=WORKSPACE, workspaceId=X (X 必须是同 org 的 project)
//   - 全组织可见:   visibility=ORG,  workspaceId 保持原样 (null 或 X 都行)
//
// backend 一次 update 落两字段 + 校验 project 归属 + owner 权限.
// 想显式清空归属 (回到未发布) → 传 workspaceId=null.
export const setMindmapPublishSchema = z.object({
  mindmapId: z.string().cuid('无效的项目ID'),
  visibility: MindmapVisibilitySchema,
  /**
   * undefined → 不改 workspaceId (只切 visibility)
   * null      → 清空 workspaceId (回到"我的图")
   * string    → 发布到指定 project
   */
  workspaceId: z.string().nullish()
})
export type SetMindmapPublishInput = z.infer<typeof setMindmapPublishSchema>
