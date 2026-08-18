/**
 * CommentContext - 评论服务和数据的 React Context
 *
 * 在 MindMapCanvas 中创建，提供给所有评论相关子组件使用。
 * 这样组件只需 useCommentContext() 就能拿到 service + 数据，
 * 不需要 prop drilling 或重复调用 hook。
 */

import { createContext, useContext, type ReactNode } from 'react'
import type {
  CommentService,
  CommentSnapshot
} from '@/products/mind/features/mindmap/services/comment-service'
import { EMPTY_SNAPSHOT } from '@/products/mind/features/mindmap/services/comment-service'

export interface CommentContextValue {
  /** CommentService 实例，用于 CRUD 操作 */
  service: CommentService | null
  /** 按节点分组的评论数据 */
  comments: CommentSnapshot['comments']
  /** 按节点统计的评论信息 */
  stats: CommentSnapshot['stats']
  /** 评论总数 */
  totalComments: number
}

const defaultValue: CommentContextValue = {
  service: null,
  comments: EMPTY_SNAPSHOT.comments,
  stats: EMPTY_SNAPSHOT.stats,
  totalComments: 0
}

const CommentContext = createContext<CommentContextValue>(defaultValue)

/**
 * CommentProvider - 包裹评论相关子组件
 *
 * 由 MindMapCanvas 在 useCommentService 之后提供。
 */
export function CommentProvider({
  value,
  children
}: {
  value: CommentContextValue
  children: ReactNode
}) {
  return <CommentContext.Provider value={value}>{children}</CommentContext.Provider>
}

/**
 * useCommentContext - 获取评论 service 和数据
 *
 * 在 CommentProvider 内使用。如果在 Provider 外部调用，
 * 返回的 service 为 null、数据为空（不抛错，因为可能在非评论页面中使用）。
 */
export function useCommentContext(): CommentContextValue {
  return useContext(CommentContext)
}
