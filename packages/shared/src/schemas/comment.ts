import { z } from 'zod'

// 评论相关的 Zod Schema 定义
// tRPC 会自动从这些 schema 推导出 TypeScript 类型

export const createCommentSchema = z.object({
  mindmapId: z.string().min(1, '思维导图ID不能为空'),
  nodeUid: z.string().min(1, '节点UID不能为空'),
  content: z.string().min(1, '评论内容不能为空').max(1000, '评论内容不能超过1000字符')
})

export const updateCommentSchema = z.object({
  commentId: z.string().min(1, '评论ID不能为空'),
  content: z.string().min(1, '评论内容不能为空').max(1000, '评论内容不能超过1000字符')
})

export const deleteCommentSchema = z.object({
  commentId: z.string().min(1, '评论ID不能为空')
})

export const getNodeCommentsSchema = z.object({
  mindmapId: z.string().min(1, '思维导图ID不能为空'),
  nodeUid: z.string().min(1, '节点UID不能为空'),
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(50).default(20)
})

export const getCommentStatsSchema = z.object({
  mindmapId: z.string().min(1, '思维导图ID不能为空')
})

// 评论数据类型
export interface CommentData {
  id: string
  mindmapId?: string
  nodeUid: string
  content: string
  userId: string
  userName: string
  userAvatar?: string
  createdAt: string
  updatedAt: string
  deletedAt?: string
  isEdited?: boolean
  user?: {
    id: string
    name: string
    avatar?: string
  }
}

// YJS 评论数据结构 - 用于 Y.Map 存储
export interface YJSCommentData {
  id: string
  mindmapId: string
  nodeUid: string
  userId: string
  userName: string
  userAvatar?: string
  content: string
  createdAt: string
  updatedAt: string
}

// 用户信息接口
export interface UserInfo {
  id: string
  name: string
  avatar?: string
  userId?: string // 数据库用户ID
}

// 评论统计类型
export interface CommentStats {
  [nodeUid: string]: {
    count: number
    hasUnread?: boolean
    latestComment?: {
      content: string
      userName: string
      createdAt: string
    }
  }
}

// 导出类型（从 schema 推导）
export type CreateCommentInput = z.infer<typeof createCommentSchema>
export type UpdateCommentInput = z.infer<typeof updateCommentSchema>
export type DeleteCommentInput = z.infer<typeof deleteCommentSchema>
export type GetNodeCommentsInput = z.infer<typeof getNodeCommentsSchema>
export type GetCommentStatsInput = z.infer<typeof getCommentStatsSchema>
