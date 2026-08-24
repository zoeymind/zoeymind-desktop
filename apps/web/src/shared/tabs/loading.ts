/**
 * Per-tab loading state (reactive).
 *
 * EditorPane 挂载后到 mindmap 引擎首帧 setData 完成之间, 该 tab 的 title 可能是
 * 从 URL/持久化恢复的旧值. TabBar 用这里的 loading 位显示 spinner, 让用户明确
 * "还在加载" 而不是 "已经加载完但标题空/错".
 *
 * 设计:
 *   - openTab -> setLoading(id, true)
 *   - useStorageManager 初次 sync() 完成 -> setLoading(id, false)
 *   - closeTab -> clear(id)
 */
import { create } from "zustand"

interface TabLoadingState {
  loading: Record<string, boolean>
  setLoading: (tabId: string, value: boolean) => void
  clear: (tabId: string) => void
}

export const useTabLoading = create<TabLoadingState>()(set => ({
  loading: {},
  setLoading: (tabId, value) =>
    set(state => {
      if ((state.loading[tabId] ?? false) === value) return state
      return { loading: { ...state.loading, [tabId]: value } }
    }),
  clear: tabId =>
    set(state => {
      if (!(tabId in state.loading)) return state
      const next = { ...state.loading }
      delete next[tabId]
      return { loading: next }
    }),
}))
