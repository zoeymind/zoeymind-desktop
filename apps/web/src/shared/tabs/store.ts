/**
 * 工作区 Tab 状态 —— VS Code / 浏览器风格多文档 shell.
 *
 * 关键设计:
 *   - tab.id 是**稳定 React key**, 从 openTab 那一刻起永不变.
 *     draft 用 `unsaved-*` 前缀; 直接打开的 file tab 用 projectId.
 *   - tab.projectId 是可选真身: draft 时未定, 首次保存后写入.
 *     save-flow / useSaveFlow 走 projectId; 内部 useCanvasManager 等继续
 *     用 tab.id 作为稳定 workspaceId, 因此保存后不 remount.
 *   - Home 是隐式的固定位, 不在 tabs 数组里 (activeId === 'home').
 */
import { create } from "zustand"
import { persist } from "zustand/middleware"
import { useLoadingStore } from "@/shared/app-shared/loading"
import { useTabLoading } from "./loading"

export type TabId = string | "home"

export interface OpenTab {
  id: string
  kind: "draft" | "file"
  title: string
  /** 已保存/已入库项目在 SqlProjectRepo 里的 uuid; draft 未定. */
  projectId?: string
}

interface TabsState {
  tabs: OpenTab[]
  activeId: TabId
  openTab: (tab: OpenTab) => void
  closeTab: (id: string) => void
  setActive: (id: TabId) => void
  renameTab: (id: string, title: string) => void
  /**
   * draft 保存成功后**就地**升级 (id 保持不变, 只加 projectId 并翻 kind='file').
   * 这样 EditorPane 的 React key 稳定, 保存后不 remount / 不 flash.
   */
  promoteDraftInPlace: (tabId: string, projectId: string, title?: string) => void
  /** 拖拽重排后按新 id 顺序应用. 未在 ids 中的 tab 忽略, ids 中不存在的 id 忽略. */
  reorderTabs: (ids: string[]) => void
  goHome: () => void
}

// 触发 SqlProjectRepo.touchLastOpened; 失败不影响 UI (静默).
async function touchLastOpenedSafe(projectId: string): Promise<void> {
  try {
    const { touchLastOpened } = await import("@/shared/native")
    await touchLastOpened(projectId)
  } catch {
    /* ignore */
  }
}

export const useTabs = create<TabsState>()(
  persist(
    set => ({
      tabs: [],
      activeId: "home",

      openTab: tab => {
        let opened = false
        set(state => {
          const existing = state.tabs.find(
            t =>
              t.id === tab.id ||
              (tab.projectId && (t.projectId === tab.projectId || t.id === tab.projectId))
          )
          if (existing) {
            if (existing.projectId) void touchLastOpenedSafe(existing.projectId)
            return { ...state, activeId: existing.id }
          }
          opened = true
          if (tab.projectId) void touchLastOpenedSafe(tab.projectId)
          return { tabs: [...state.tabs, tab], activeId: tab.id }
        })
        if (opened) {
          useTabLoading.getState().setLoading(tab.id, true)
          // ⚡ 同步拉起全局 loading, 与 activeId 翻转在同一 batch 内提交,
          // EditorPane 首帧就被 <Loading> 覆盖, 不会闪 raf-gated Loader2/空画布.
          // MindMapCanvas 挂载后会用具体 tip 覆盖, 最终 hideLoading 由它负责.
          useLoadingStore.getState().showLoading()
        }
      },

      closeTab: id => {
        useTabLoading.getState().clear(id)
        set(state => {
          const next = state.tabs.filter(t => t.id !== id)
          if (state.activeId !== id) return { ...state, tabs: next }
          const fallback: TabId = next.length > 0 ? next[next.length - 1].id : "home"
          return { tabs: next, activeId: fallback }
        })
      },

      setActive: id => set({ activeId: id }),

      goHome: () => set({ activeId: "home" }),

      renameTab: (id, title) =>
        set(state => ({
          tabs: state.tabs.map(t => (t.id === id ? { ...t, title } : t)),
        })),

      promoteDraftInPlace: (tabId, projectId, title) =>
        set(state => ({
          tabs: state.tabs.map(t =>
            t.id === tabId ? { ...t, kind: "file", projectId, title: title ?? t.title } : t
          ),
        })),

      reorderTabs: ids =>
        set(state => {
          const byId = new Map(state.tabs.map(t => [t.id, t]))
          const reordered = ids.flatMap(id => {
            const t = byId.get(id)
            return t ? [t] : []
          })
          // ids 中不含的 tab (理论上不应出现) 追加保底.
          for (const t of state.tabs) {
            if (!ids.includes(t.id)) reordered.push(t)
          }
          return { tabs: reordered }
        }),
    }),
    {
      name: "zoeymind:tabs",
      version: 2,
      // draft 不能持久化: pendingProjects 只在内存, 重启后 tempId 失效.
      // 已保存 tab 有 projectId, 重启后能恢复 (通过 projectId 读 SqlProjectRepo).
      partialize: state => ({
        tabs: state.tabs.filter(t => t.kind === "file" && !!t.projectId),
        activeId: state.activeId === "home" ? "home" : state.activeId,
      }),
    }
  )
)
