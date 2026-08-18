import { z } from 'zod'

/**
 * 协作相关的 Zod Schema 定义
 */

/**
 * 创建协作房间
 */
export const createCollaborationRoomSchema = z.object({
  mindmapId: z.string().min(1, '思维导图ID不能为空'),
  name: z.string().optional(),
  description: z.string().optional()
})

/**
 * 获取房间信息
 */
export const getRoomInfoSchema = z.object({
  projectId: z.string().min(1, '项目ID不能为空')
})

/**
 * 根据思维导图ID获取协作房间
 */
export const getByMindmapIdSchema = z.object({
  mindmapId: z.string().min(1, '思维导图ID不能为空')
})

/**
 * 加入/离开/关闭协作房间
 */
export const roomIdSchema = z.object({
  roomId: z.string().min(1, '房间ID不能为空')
})

/**
 * 获取协作日志
 */
export const getCollaborationLogsSchema = z.object({
  roomId: z.string().min(1, '房间ID不能为空'),
  limit: z.number().min(1).max(100).default(50),
  offset: z.number().min(0).default(0)
})
