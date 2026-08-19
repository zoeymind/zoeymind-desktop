import { createStore, type StoreApi } from "zustand/vanilla"
import type MindMap from "simple-mind-map"
import type {
  DropdownState,
  IconToolbarState,
} from "@/products/mind/features/mindmap/components/types"
import type { FormatTabType } from "@/products/mind/stores"

export const PROJECT_SESSION_LIFECYCLE = {
  IDLE: "idle",
  LOADING: "loading",
  READY: "ready",
  ERROR: "error",
} as const

export type ProjectSessionLifecycle =
  (typeof PROJECT_SESSION_LIFECYCLE)[keyof typeof PROJECT_SESSION_LIFECYCLE]

export interface ProjectSessionCommands {
  save?: () => Promise<void>
  saveAs?: (path: string) => Promise<void>
  flushRecovery?: () => Promise<void>
  discard?: () => Promise<void>
  dispose?: () => void
}

export interface ProjectSessionUIState {
  activeFormatTab: FormatTabType
  targetNodeUid?: string
  dropdownState: DropdownState
  iconToolbarState: IconToolbarState
  isSearchActive: boolean
  searchInitialText: string
  forceDefaultTemplate: boolean
}

export interface ProjectSessionState {
  projectId: string
  lifecycle: ProjectSessionLifecycle
  loadError: string | null
  mindMap: MindMap | null
  dirty: boolean
  title: string | null
  previewActive: boolean
  exitPreview: (() => void) | null
  ui: ProjectSessionUIState
  commands: ProjectSessionCommands
  setLifecycle: (lifecycle: ProjectSessionLifecycle) => void
  setLoadError: (loadError: string | null) => void
  setMindMap: (mindMap: MindMap | null) => void
  setDirty: (dirty: boolean) => void
  setTitle: (title: string | null) => void
  setPreview: (active: boolean, exit?: (() => void) | null) => void
  setUI: (ui: Partial<ProjectSessionUIState>) => void
  setCommands: (commands: ProjectSessionCommands) => void
}

export type ProjectSessionStore = StoreApi<ProjectSessionState>

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

export function createProjectSessionStore(projectId: string): ProjectSessionStore {
  return createStore<ProjectSessionState>()(set => ({
    projectId,
    lifecycle: PROJECT_SESSION_LIFECYCLE.IDLE,
    loadError: null,
    mindMap: null,
    dirty: false,
    title: null,
    previewActive: false,
    exitPreview: null,
    ui: {
      activeFormatTab: undefined,
      targetNodeUid: undefined,
      dropdownState: initialDropdownState,
      iconToolbarState: initialIconToolbarState,
      isSearchActive: false,
      searchInitialText: "",
      forceDefaultTemplate: false,
    },
    commands: {},
    setLifecycle: lifecycle => set({ lifecycle }),
    setLoadError: loadError => set({ loadError }),
    setMindMap: mindMap => set({ mindMap }),
    setDirty: dirty => set(state => (state.dirty === dirty ? state : { dirty })),
    setTitle: title => set({ title }),
    setPreview: (previewActive, exitPreview = null) => set({ previewActive, exitPreview }),
    setUI: ui => set(state => ({ ui: { ...state.ui, ...ui } })),
    setCommands: commands => set({ commands }),
  }))
}
