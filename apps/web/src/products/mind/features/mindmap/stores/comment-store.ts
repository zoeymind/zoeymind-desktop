/** 评论 store —— 桌面端 no-op。 */

interface CommentStoreState {
  commentsByNode: Record<string, unknown[]>
  syncFromHook: (data: unknown) => void
  clear: () => void
}

const STATE: CommentStoreState = {
  commentsByNode: {},
  syncFromHook: () => undefined,
  clear: () => undefined
}

export function useCommentStore<T = CommentStoreState>(selector?: (s: CommentStoreState) => T): T {
  return (selector ? selector(STATE) : STATE) as T
}
