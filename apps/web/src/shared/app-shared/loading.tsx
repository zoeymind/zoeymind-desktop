/**
 * 全局 Loading 状态 Provider —— 桌面端保留 mindmap 编辑器加载动画能力。
 *
 * API 尽量与产品仓一致：`useLoading()` 返回 { showLoading, hideLoading, isLoading, tip }。
 */
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'

interface LoadingContextValue {
  isLoading: boolean
  tip: string | null
  showLoading: (tip?: string) => void
  hideLoading: () => void
}

const LoadingContext = createContext<LoadingContextValue | null>(null)

export function LoadingProvider({ children }: { children: ReactNode }) {
  const [isLoading, setIsLoading] = useState(false)
  const [tip, setTip] = useState<string | null>(null)

  const showLoading = useCallback((next?: string) => {
    setTip(next ?? null)
    setIsLoading(true)
  }, [])

  const hideLoading = useCallback(() => {
    setIsLoading(false)
    setTip(null)
  }, [])

  const value = useMemo<LoadingContextValue>(
    () => ({ isLoading, tip, showLoading, hideLoading }),
    [isLoading, tip, showLoading, hideLoading]
  )

  return <LoadingContext.Provider value={value}>{children}</LoadingContext.Provider>
}

export function useLoading(): LoadingContextValue {
  const ctx = useContext(LoadingContext)
  if (!ctx) {
    throw new Error('useLoading must be inside <LoadingProvider>')
  }
  return ctx
}
