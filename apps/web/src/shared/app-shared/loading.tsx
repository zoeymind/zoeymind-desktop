/**
 * 全局 Loading 状态 Provider —— 与产品仓一致的 API：
 *   useLoading() → { loading, tip, progress, showLoading, hideLoading, updateProgress }
 */
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'

interface LoadingContextValue {
  loading: boolean
  isLoading: boolean
  tip: string | null
  progress: number
  showLoading: (tip?: string) => void
  hideLoading: () => void
  updateProgress: (progress: number) => void
}

const LoadingContext = createContext<LoadingContextValue | null>(null)

export function LoadingProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(false)
  const [tip, setTip] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)

  const showLoading = useCallback((next?: string) => {
    setTip(next ?? null)
    setProgress(0)
    setLoading(true)
  }, [])

  const hideLoading = useCallback(() => {
    setLoading(false)
    setTip(null)
    setProgress(0)
  }, [])

  const updateProgress = useCallback((next: number) => {
    setProgress(Math.max(0, Math.min(100, next)))
  }, [])

  const value = useMemo<LoadingContextValue>(
    () => ({
      loading,
      isLoading: loading,
      tip,
      progress,
      showLoading,
      hideLoading,
      updateProgress
    }),
    [loading, tip, progress, showLoading, hideLoading, updateProgress]
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
