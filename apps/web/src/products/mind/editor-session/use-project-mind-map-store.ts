import { useStore } from "zustand"
import type MindMap from "simple-mind-map"
import {
  PROJECT_SESSION_LIFECYCLE,
  type ProjectSessionState,
  type ProjectSessionStore,
} from "./project-session-store"
import { useProjectSessionStore } from "./project-session-context"

export interface ProjectMindMapState {
  mindMap: MindMap | null
  isLoading: boolean
  loadError: string | null
  isPreviewMode: boolean
  exitPreviewCallback: (() => void) | null
  title: string | null
  isDirty: boolean
  setMindMap: (mindMap: MindMap | null) => void
  setLoading: (loading: boolean) => void
  setLoadError: (error: string | null) => void
  setPreviewMode: (active: boolean) => void
  setTitle: (title: string | null) => void
  setDirty: (dirty: boolean) => void
  setExitPreviewCallback: (exit: (() => void) | null) => void
  exitPreview: () => void
  initializeMindMap: (params: { mindMap: MindMap | null }) => void
  resetMindMap: () => void
}

function setSessionMindMap(store: ProjectSessionStore, mindMap: MindMap | null): void {
  const session = store.getState()
  session.setMindMap(mindMap)
  session.setLifecycle(mindMap ? PROJECT_SESSION_LIFECYCLE.READY : PROJECT_SESSION_LIFECYCLE.IDLE)
}

const actionsByStore = new WeakMap<
  ProjectSessionStore,
  Omit<
    ProjectMindMapState,
    | "mindMap"
    | "isLoading"
    | "loadError"
    | "isPreviewMode"
    | "exitPreviewCallback"
    | "title"
    | "isDirty"
  >
>()
const stateBySession = new WeakMap<ProjectSessionState, ProjectMindMapState>()

function getActions(store: ProjectSessionStore) {
  const existing = actionsByStore.get(store)
  if (existing) return existing
  const actions = {
    setMindMap: (mindMap: MindMap | null) => setSessionMindMap(store, mindMap),
    setLoading: (loading: boolean) => {
      const current = store.getState()
      current.setLifecycle(
        loading
          ? PROJECT_SESSION_LIFECYCLE.LOADING
          : current.loadError
            ? PROJECT_SESSION_LIFECYCLE.ERROR
            : current.mindMap
              ? PROJECT_SESSION_LIFECYCLE.READY
              : PROJECT_SESSION_LIFECYCLE.IDLE
      )
    },
    setLoadError: (error: string | null) => {
      const current = store.getState()
      current.setLoadError(error)
      current.setLifecycle(
        error
          ? PROJECT_SESSION_LIFECYCLE.ERROR
          : current.mindMap
            ? PROJECT_SESSION_LIFECYCLE.READY
            : PROJECT_SESSION_LIFECYCLE.IDLE
      )
    },
    setPreviewMode: (active: boolean) => {
      const current = store.getState()
      current.setPreview(active, current.exitPreview)
    },
    setTitle: (title: string | null) => store.getState().setTitle(title),
    setDirty: (dirty: boolean) => store.getState().setDirty(dirty),
    setExitPreviewCallback: (exit: (() => void) | null) => {
      const current = store.getState()
      current.setPreview(current.previewActive, exit)
    },
    exitPreview: () => store.getState().exitPreview?.(),
    initializeMindMap: ({ mindMap }: { mindMap: MindMap | null }) =>
      setSessionMindMap(store, mindMap),
    resetMindMap: () => {
      const current = store.getState()
      current.setMindMap(null)
      current.setLoadError(null)
      current.setLifecycle(PROJECT_SESSION_LIFECYCLE.IDLE)
      current.setPreview(false, null)
      current.setTitle(null)
    },
  }
  actionsByStore.set(store, actions)
  return actions
}

function selectState(
  session: ProjectSessionState,
  store: ProjectSessionStore
): ProjectMindMapState {
  const existing = stateBySession.get(session)
  if (existing) return existing
  const state = {
    mindMap: session.mindMap,
    isLoading: session.lifecycle === PROJECT_SESSION_LIFECYCLE.LOADING,
    loadError: session.loadError,
    isPreviewMode: session.previewActive,
    exitPreviewCallback: session.exitPreview,
    title: session.title,
    isDirty: session.dirty,
    ...getActions(store),
  }
  stateBySession.set(session, state)
  return state
}

export function useProjectMindMapStore(): ProjectMindMapState
export function useProjectMindMapStore<T>(selector: (state: ProjectMindMapState) => T): T
export function useProjectMindMapStore<T>(selector?: (state: ProjectMindMapState) => T) {
  const store = useProjectSessionStore()
  return useStore(store, session => {
    const state = selectState(session, store)
    return selector ? selector(state) : state
  })
}
