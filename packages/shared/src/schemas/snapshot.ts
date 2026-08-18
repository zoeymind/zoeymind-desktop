import { z } from 'zod'

/**
 * 创建快照输入验证
 */
export const createSnapshotSchema = z.object({
  mindmapId: z.string().cuid('无效的思维导图ID格式'),
  name: z.string().min(1, '快照名称不能为空').max(100, '快照名称最多100个字符'),
  description: z.string().max(500, '快照描述最多500个字符').optional(),
  isAuto: z.boolean().default(false)
})
export type CreateSnapshotInput = z.infer<typeof createSnapshotSchema>

/**
 * 获取快照列表输入验证
 */
export const getSnapshotsSchema = z.object({
  mindmapId: z.string().cuid('无效的思维导图ID格式'),
  includeAuto: z.boolean().default(true), // 是否包含自动快照
  page: z.number().int().min(1, '页码必须大于0').default(1),
  limit: z.number().int().min(1, '每页数量必须大于0').max(50, '每页最多50个').default(20)
})
export type GetSnapshotsInput = z.infer<typeof getSnapshotsSchema>

/**
 * 获取单个快照输入验证
 */
export const getSnapshotSchema = z.object({
  snapshotId: z.string().cuid('无效的快照ID格式')
})
export type GetSnapshotInput = z.infer<typeof getSnapshotSchema>

/**
 * 删除快照输入验证
 */
export const deleteSnapshotSchema = z.object({
  snapshotId: z.string().cuid('无效的快照ID格式')
})
export type DeleteSnapshotInput = z.infer<typeof deleteSnapshotSchema>

/**
 * 恢复快照输入验证
 */
export const restoreSnapshotSchema = z.object({
  snapshotId: z.string().cuid('无效的快照ID格式')
})
export type RestoreSnapshotInput = z.infer<typeof restoreSnapshotSchema>

/**
 * 快照数据结构
 */
export interface SnapshotData {
  id: string
  mindmapId: string
  name: string
  description?: string
  version: number
  isAuto: boolean
  nodeCount: number
  createdBy: string
  createdAt: Date
  creator?: {
    id: string
    name: string | null
    avatar: string | null
  }
}

/**
 * 快照详情数据结构（包含实际的思维导图数据）
 */
export interface SnapshotDetail extends SnapshotData {
  data: unknown // 思维导图数据
  viewData?: unknown // 视图数据
}
