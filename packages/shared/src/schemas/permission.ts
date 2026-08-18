import { z } from 'zod'
import { MindmapRoleSchema } from './mindmap'

// 创建权限请求
export const createMindmapPermissionSchema = z.object({
  mindmapId: z.string(),
  userId: z.string(),
  role: MindmapRoleSchema,
  expiresAt: z.string().datetime().optional()
})

// 更新权限请求
export const updateMindmapPermissionSchema = z.object({
  mindmapId: z.string(),
  userId: z.string(),
  role: MindmapRoleSchema,
  expiresAt: z.string().datetime().nullable().optional()
})

// 删除权限请求
export const deleteMindmapPermissionSchema = z.object({
  mindmapId: z.string(),
  userId: z.string()
})

// 获取权限列表请求
export const getMindmapPermissionsSchema = z.object({
  mindmapId: z.string()
})

// 创建分享链接请求
export const createShareLinkSchema = z.object({
  mindmapId: z.string(),
  role: MindmapRoleSchema,
  expiresAt: z.string().datetime().optional()
})

// 更新分享链接请求
export const updateShareLinkSchema = z.object({
  linkId: z.string(),
  role: MindmapRoleSchema.optional(),
  isActive: z.boolean().optional(),
  expiresAt: z.string().datetime().nullable().optional()
})

// 删除分享链接请求
export const deleteShareLinkSchema = z.object({
  linkId: z.string()
})

// 获取分享链接列表请求
export const getShareLinksSchema = z.object({
  mindmapId: z.string()
})

// 通过分享链接访问请求
export const accessByShareLinkSchema = z.object({
  linkId: z.string()
})

// 检查权限请求
export const checkPermissionSchema = z.object({
  mindmapId: z.string(),
  action: z.enum(['read', 'write', 'delete']).default('read')
})

// 权限响应类型
export const mindmapPermissionResponseSchema = z.object({
  mindmapId: z.string(),
  userId: z.string(),
  role: MindmapRoleSchema,
  source: z.string(),
  grantedBy: z.string().nullable(),
  expiresAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
})

// 分享链接响应类型
export const shareLinkResponseSchema = z.object({
  linkId: z.string(),
  mindmapId: z.string(),
  role: MindmapRoleSchema,
  isActive: z.boolean(),
  expiresAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime()
})

// 导出类型
export type CreateMindmapPermissionInput = z.infer<typeof createMindmapPermissionSchema>
export type UpdateMindmapPermissionInput = z.infer<typeof updateMindmapPermissionSchema>
export type DeleteMindmapPermissionInput = z.infer<typeof deleteMindmapPermissionSchema>
export type GetMindmapPermissionsInput = z.infer<typeof getMindmapPermissionsSchema>

export type CreateShareLinkInput = z.infer<typeof createShareLinkSchema>
export type UpdateShareLinkInput = z.infer<typeof updateShareLinkSchema>
export type DeleteShareLinkInput = z.infer<typeof deleteShareLinkSchema>
export type GetShareLinksInput = z.infer<typeof getShareLinksSchema>
export type AccessByShareLinkInput = z.infer<typeof accessByShareLinkSchema>

export type CheckPermissionInput = z.infer<typeof checkPermissionSchema>
export type MindmapPermissionResponse = z.infer<typeof mindmapPermissionResponseSchema>
export type ShareLinkResponse = z.infer<typeof shareLinkResponseSchema>
