/**
 * useCommentStore - 评论 UI 状态管理（精简版）
 *
 * 只管理面板 UI 状态，不代理评论数据操作。
 * 评论数据和 CRUD 操作由 CommentService + useCommentYJS + CommentContext 提供。
 *
 * 使用方：
 * - useContextMenu: openCommentPanel(nodeUid) 打开评论面板
 * - FormatPanel: isPanelOpen、closeCommentPanel
 * - CommentPanel: activeNodeUid
 */

import { create } from 'zustand'
import { devtools } from 'zustand/middleware'

interface CommentStoreState {
  // UI 状态
  isPanelOpen: boolean
  activeNodeUid: string | null

  // 兼容：评论数据 snapshot（由 MindMapCanvas 通过 syncFromHook 同步）
  totalComments: number
  stats: {
    [nodeUid: string]: {
      count: number
      hasUnread?: boolean
      latestComment?: { content: string; userName: string; createdAt: string }
    }
  }

  // Actions
  openCommentPanel: (nodeUid?: string) => void
  closeCommentPanel: () => void

  // 兼容：供 MindMapCanvas 从 hook 同步数据到 store（FormatPanel 需要 totalComments）
  syncFromHook: (data: { totalComments: number; stats: CommentStoreState['stats'] }) => void

  resetComments: () => void
}

export const useCommentStore = create<CommentStoreState>()(
  devtools(
    set => ({
      // Initial state
      isPanelOpen: false,
      activeNodeUid: null,
      totalComments: 0,
      stats: {},

      openCommentPanel: nodeUid => {
        set({
          isPanelOpen: true,
          activeNodeUid: nodeUid || null
        })
      },

      closeCommentPanel: () => {
        set({
          isPanelOpen: false,
          activeNodeUid: null
        })
      },

      syncFromHook: data => {
        set({
          totalComments: data.totalComments,
          stats: data.stats
        })
      },

      resetComments: () => {
        set({
          isPanelOpen: false,
          activeNodeUid: null,
          totalComments: 0,
          stats: {}
        })
      }
    }),
    { name: 'comment-store' }
  )
)
