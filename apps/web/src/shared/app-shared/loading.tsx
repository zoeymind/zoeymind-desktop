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

/** Compatibility provider; loading state lives in the Zustand store. */
export function LoadingProvider({ children }: { children: ReactNode }) {
  return <>{children}</>
}
