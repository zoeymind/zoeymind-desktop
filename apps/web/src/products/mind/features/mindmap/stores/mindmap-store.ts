import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import type { default as MindMap } from 'simple-mind-map'

export type MindMapRef = MindMap | null

export type ExitPreviewCallback = (() => void) | null

interface MindMapState {
  mindMap: MindMapRef
  isLoading: boolean
  loadError: string | null

  // 预览模式相关
  isPreviewMode: boolean
  exitPreviewCallback: ExitPreviewCallback

  // 项目标题 (用于同步到浏览器 Tab)
  title: string | null

  // 桌面端脏态：画布变更未持久化到 .zmind
  isDirty: boolean

  // Actions
  setMindMap: (mindMap: MindMapRef) => void
  setLoading: (loading: boolean) => void
  setLoadError: (error: string | null) => void
  setPreviewMode: (isPreview: boolean) => void
  setTitle: (title: string | null) => void
  setDirty: (dirty: boolean) => void

  // 预览模式回调管理
  setExitPreviewCallback: (callback: ExitPreviewCallback) => void

  exitPreview: () => void

  // 复合操作
  initializeMindMap: (params: { mindMap: MindMapRef }) => void

  resetMindMap: () => void
}

export const useMindMapStore = create<MindMapState>()(
  devtools(
    set => ({
      // Initial state
      mindMap: null,
      isLoading: false,
      loadError: null,
      isPreviewMode: false,
      exitPreviewCallback: null,
      title: null,
      isDirty: false,

      // Actions
      setMindMap: mindMap => {
        set({ mindMap })
      },

      setLoading: loading => {
        set({ isLoading: loading })
      },

      setLoadError: error => {
        set({ loadError: error })
      },

      setPreviewMode: isPreview => {
        set({ isPreviewMode: isPreview })
      },

      setExitPreviewCallback: callback => {
        set({ exitPreviewCallback: callback })
      },

      setTitle: title => {
        set({ title })
      },

      setDirty: dirty => {
        set({ isDirty: dirty })
      },

      exitPreview: () => {
        const state = useMindMapStore.getState()
        if (state.exitPreviewCallback) {
          state.exitPreviewCallback()
        }
      },

      initializeMindMap: ({ mindMap }) => {
        set({ mindMap })
      },

      resetMindMap: () => {
        set({
          mindMap: null,
          isLoading: false,
          loadError: null,
          isPreviewMode: false,
          exitPreviewCallback: null,
          title: null
        })
      }
    }),
    {
      name: 'mindmap-store'
    }
  )
)
