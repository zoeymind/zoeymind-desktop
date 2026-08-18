/** 评论 Context —— 桌面端 passthrough。 */
import { createContext, useContext, type ReactNode } from 'react'

export interface CommentContextValue {
  commentsByNode: Record<string, unknown[]>
  addComment: (nodeId: string, text: string) => Promise<void>
  deleteComment: (id: string) => Promise<void>
  updateComment: (id: string, text: string) => Promise<void>
}

const NOOP_VALUE: CommentContextValue = {
  commentsByNode: {},
  addComment: async () => undefined,
  deleteComment: async () => undefined,
  updateComment: async () => undefined
}

const Ctx = createContext<CommentContextValue>(NOOP_VALUE)

export function CommentProvider({ children, value }: { children: ReactNode; value?: CommentContextValue }) {
  return <Ctx.Provider value={value ?? NOOP_VALUE}>{children}</Ctx.Provider>
}

export function useCommentContext(): CommentContextValue {
  return useContext(Ctx)
}
