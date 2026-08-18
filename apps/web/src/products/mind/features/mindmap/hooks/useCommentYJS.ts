/** 评论 Yjs 同步 —— 桌面端 no-op。返回空评论数据 + 空回调。 */
import { useMemo } from 'react'
import type { default as MindMap } from 'simple-mind-map'

const NOOP_ASYNC = async () => undefined

export function useCommentYJS(_mindMap: MindMap | null, _enabled: boolean) {
  return useMemo(
    () => ({
      commentsByNode: {} as Record<string, unknown[]>,
      threadsByNode: {} as Record<string, unknown[]>,
      isReady: true,
      addComment: NOOP_ASYNC,
      deleteComment: NOOP_ASYNC,
      updateComment: NOOP_ASYNC,
      subscribe: () => () => undefined
    }),
    []
  )
}
