import { create } from "zustand"
import { devtools } from "zustand/middleware"
import type {
  DropdownState,
  IconToolbarState,
} from "@/products/mind/features/mindmap/components/types"
import { logger } from "@zoeymind/logger"

export type FormatTabType = "tags" | "ai" | "video" | "theme" | "stream" | "comment" | undefined

interface UIState {
  // 格式面板状态
  activeFormatTab: FormatTabType
  targetNodeUid: string | undefined

  // 下拉菜单状态
  dropdownState: DropdownState

  // 图标工具栏状态
  iconToolbarState: IconToolbarState

  // 搜索状态
  isSearchActive: boolean
  searchInitialText: string

  // 预览状态
  isPreviewMode: boolean

  // 加载状态
  isLoading: boolean
  loadError: string | undefined
  forceDefaultTemplate: boolean

  // Actions
  setActiveFormatTab: (tab: FormatTabType) => void
  setTargetNodeUid: (nodeUid: string | undefined) => void
  setDropdownState: (state: DropdownState) => void
  setIconToolbarState: (state: IconToolbarState) => void
  setSearchActive: (active: boolean) => void
  setSearchInitialText: (text: string) => void
  setPreviewMode: (preview: boolean) => void
  setLoading: (loading: boolean) => void
  setLoadError: (error: string | undefined) => void
  setForceDefaultTemplate: (force: boolean) => void

  // 格式面板操作
  openFormatTab: (tab: FormatTabType, nodeUid?: string) => void
  closeFormatTab: () => void
  toggleFormatTab: (tab: FormatTabType) => void

  // 搜索操作
  startSearch: (initialText?: string) => void
  endSearch: () => void

  // 重置操作
  resetUI: () => void
}

// 初始状态
const initialDropdownState: DropdownState = {
  show: false,
  position: { x: 0, y: 0 },
  currentNode: null,
  isRoot: false,
}

const initialIconToolbarState: IconToolbarState = {
  show: false,
  position: { x: 0, y: 0 },
  node: null,
  iconType: "",
  iconName: "",
  nodeIconList: [],
}

export const useUIStore = create<UIState>()(
  devtools(
    (set, get) => ({
      // Initial state
      activeFormatTab: undefined,
      targetNodeUid: undefined,
      dropdownState: initialDropdownState,
      iconToolbarState: initialIconToolbarState,
      isSearchActive: false,
      searchInitialText: "",
      isPreviewMode: false,
      isLoading: false,
      loadError: undefined,
      forceDefaultTemplate: false,

      // Actions
      setActiveFormatTab: tab => {
        set({ activeFormatTab: tab })
      },

      setTargetNodeUid: nodeUid => {
        set({ targetNodeUid: nodeUid })
      },

      setDropdownState: state => {
        set({ dropdownState: state })
      },

      setIconToolbarState: state => {
        set({ iconToolbarState: state })
      },

      setSearchActive: active => {
        set({ isSearchActive: active })
      },

      setSearchInitialText: text => {
        set({ searchInitialText: text })
      },

      setPreviewMode: preview => {
        set({ isPreviewMode: preview })
      },

      setLoading: loading => {
        set({ isLoading: loading })
      },

      setLoadError: error => {
        set({ loadError: error })
      },

      setForceDefaultTemplate: force => {
        set({ forceDefaultTemplate: force })
      },

      // 格式面板操作
      openFormatTab: (tab, nodeUid) => {
        set({
          activeFormatTab: tab,
          targetNodeUid: nodeUid || undefined,
        })
      },

      closeFormatTab: () => {
        set({
          activeFormatTab: undefined,
          targetNodeUid: undefined,
        })
      },

      toggleFormatTab: tab => {
        const { activeFormatTab } = get()
        const newTab = activeFormatTab === tab ? undefined : tab
        set({
          activeFormatTab: newTab,
          targetNodeUid: newTab ? get().targetNodeUid : undefined,
        })
      },

      // 搜索操作
      startSearch: (initialText = "") => {
        set({
          isSearchActive: true,
          searchInitialText: initialText,
        })
      },

      endSearch: () => {
        set({
          isSearchActive: false,
          searchInitialText: "",
        })
      },

      // 重置操作
      resetUI: () => {
        logger.info("UIStore: 重置UI状态")
        set({
          activeFormatTab: undefined,
          targetNodeUid: undefined,
          dropdownState: initialDropdownState,
          iconToolbarState: initialIconToolbarState,
          isSearchActive: false,
          searchInitialText: "",
          isPreviewMode: false,
          isLoading: false,
          loadError: undefined,
          forceDefaultTemplate: false,
        })
      },
    }),
    {
      name: "ui-store",
    }
  )
)
