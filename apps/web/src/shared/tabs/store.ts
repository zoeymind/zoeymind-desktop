/**
 * 工作区 Tab 状态 —— VS Code / 浏览器风格的多文档 shell.
 *
 * 语义:
 *   - Home tab 是隐式的固定第 0 位, 不进 tabs 数组 (activeId === 'home' 表示 Home).
 *   - `tabs` 只装可关闭的 editor tab. draft = 未保存新建; file = 已入库 (projectId 是真实 uuid).
 *   - draft 的 id 就是 pendingProjects.stash 返回的 tempId (unsaved-*); file 的 id = projectId.
 *   - 同一 projectId 只允许开一个 tab (openTab 命中则 setActive).
 *   - 关闭 draft 时: 由消费方 (TabBar) 决定是否弹 UnsavedGuard, store 只提供 closeTab 原子.
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type TabId = string | 'home'

export interface OpenTab {
  id: string // draft: unsaved-*; file: projectId
  kind: 'draft' | 'file'
  title: string
}

interface TabsState {
  tabs: OpenTab[]
  activeId: TabId
  openTab: (tab: OpenTab) => void
  closeTab: (id: string) => void
  setActive: (id: TabId) => void
  renameTab: (id: string, title: string) => void
  /** draft 保存成功后, id/kind/title 一起换成 file. */
  promoteDraft: (draftId: string, projectId: string, title: string) => void
  goHome: () => void
}

export const useTabs = create<TabsState>()(
  persist(
    set => ({
      tabs: [],
      activeId: 'home',

      openTab: tab => {
        set(state => {
          const existing = state.tabs.find(t => t.id === tab.id)
          if (existing) return { ...state, activeId: tab.id }
          return { tabs: [...state.tabs, tab], activeId: tab.id }
        })
      },

      closeTab: id => {
        set(state => {
          const next = state.tabs.filter(t => t.id !== id)
          if (state.activeId !== id) return { ...state, tabs: next }
          // 关的是当前活动 tab: fallback 到最后一个还开着的; 都关光则 home.
          const fallback: TabId = next.length > 0 ? next[next.length - 1].id : 'home'
          return { tabs: next, activeId: fallback }
        })
      },

      setActive: id => set({ activeId: id }),

      goHome: () => set({ activeId: 'home' }),

      renameTab: (id, title) =>
        set(state => ({
          tabs: state.tabs.map(t => (t.id === id ? { ...t, title } : t))
        })),

      promoteDraft: (draftId, projectId, title) =>
        set(state => ({
          tabs: state.tabs.map(t =>
            t.id === draftId ? { id: projectId, kind: 'file', title } : t
          ),
          activeId: state.activeId === draftId ? projectId : state.activeId
        }))
    }),
    {
      name: 'zoeymind:tabs',
      version: 1,
      // draft tab 不能持久化: pendingProjects 只在内存, 重启后 tempId 失效.
      partialize: state => ({
        tabs: state.tabs.filter(t => t.kind === 'file'),
        activeId: state.activeId === 'home' ? 'home' : state.activeId
      })
    }
  )
)
