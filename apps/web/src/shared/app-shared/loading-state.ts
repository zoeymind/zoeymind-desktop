import { create } from "zustand"

interface LoadingState {
  loading: boolean
  tip: string | null
  progress: number
  showLoading: (tip?: string) => void
  hideLoading: () => void
  updateProgress: (progress: number) => void
}

export const useLoadingStore = create<LoadingState>()(set => ({
  loading: false,
  tip: null,
  progress: 0,
  showLoading: tip => set({ loading: true, tip: tip ?? null, progress: 0 }),
  hideLoading: () => set({ loading: false, tip: null, progress: 0 }),
  updateProgress: progress => set({ progress: Math.max(0, Math.min(100, progress)) }),
}))

export interface UseLoadingResult {
  loading: boolean
  isLoading: boolean
  tip: string | null
  progress: number
  showLoading: (tip?: string) => void
  hideLoading: () => void
  updateProgress: (progress: number) => void
}

export function useLoading(): UseLoadingResult {
  const loading = useLoadingStore(state => state.loading)
  const tip = useLoadingStore(state => state.tip)
  const progress = useLoadingStore(state => state.progress)
  const showLoading = useLoadingStore(state => state.showLoading)
  const hideLoading = useLoadingStore(state => state.hideLoading)
  const updateProgress = useLoadingStore(state => state.updateProgress)
  return { loading, isLoading: loading, tip, progress, showLoading, hideLoading, updateProgress }
}
