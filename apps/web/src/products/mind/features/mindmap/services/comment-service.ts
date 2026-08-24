/** 评论服务 —— 桌面端 no-op。 */
export const EMPTY_SNAPSHOT = { comments: [], threads: [] } as const

const NOOP_ASYNC = async () => undefined

export const commentService = {
  fetchInitialState: NOOP_ASYNC,
  addComment: NOOP_ASYNC,
  updateComment: NOOP_ASYNC,
  deleteComment: NOOP_ASYNC,
}
