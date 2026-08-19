/**
 * 全局 Loading 状态 —— zustand store 版本.
 *
 * 为什么不是 React state / context: openTab (点"新建"/双击文件) 需要**在**
 * activeId 翻转的同一个 React batch 里立刻拉起 loading, 不然 EditorPane 会先
 * 出现 raf-gated Loader2 或空白画布, 之后 MindMapCanvas 的 useEffect 才追上来
 * 拉起全局 loading -> 用户能看到闪一下 (先局部 spinner / 空画布, 再全局蒙层).
 *
 * store 化后:
 *   useLoadingStore.getState().showLoading()  <- 在 tabs store 的 openTab 里直接调
 * activeId + loading 在同一 batch 内更新, 首帧就已经是"全局 loading 覆盖" 的态,
 * 不再看到中间态.
 *
 * 对外 API `useLoading()` 保持不变 (loading/tip/progress + show/hide/updateProgress).
 * `LoadingProvider` 保留为 no-op 透传, 让 App.tsx 无需改 import 顺序.
 */
import type { ReactNode } from "react"
import { create } from "zustand"

interface LoadingState {
  loading: boolean
  tip: string | null
  progress: number
  showLoading: (tip?: string) => void
  hideLoading: () => void
  updateProgress: (progress: number) => void
}

// eslint-disable-next-line react-refresh/only-export-components
export const useLoadingStore = create<LoadingState>()(set => ({
  loading: false,
  tip: null,
  progress: 0,
  showLoading: tip => set({ loading: true, tip: tip ?? null, progress: 0 }),
  hideLoading: () => set({ loading: false, tip: null, progress: 0 }),
  updateProgress: progress => set({ progress: Math.max(0, Math.min(100, progress)) }),
}))

interface UseLoadingResult {
  loading: boolean
  isLoading: boolean
  tip: string | null
  progress: number
  showLoading: (tip?: string) => void
  hideLoading: () => void
  updateProgress: (progress: number) => void
}

// eslint-disable-next-line react-refresh/only-export-components
export function useLoading(): UseLoadingResult {
  const loading = useLoadingStore(s => s.loading)
  const tip = useLoadingStore(s => s.tip)
  const progress = useLoadingStore(s => s.progress)
  const showLoading = useLoadingStore(s => s.showLoading)
  const hideLoading = useLoadingStore(s => s.hideLoading)
  const updateProgress = useLoadingStore(s => s.updateProgress)
  return { loading, isLoading: loading, tip, progress, showLoading, hideLoading, updateProgress }
}

/**
 * 兼容旧引用: 桌面端 loading 状态已迁移到 zustand store, 不再需要 Provider,
 * 但保留组件避免既有 import 报错.
 */
export function LoadingProvider({ children }: { children: ReactNode }) {
  return <>{children}</>
}
