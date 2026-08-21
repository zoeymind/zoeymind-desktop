import type { ProjectSessionStore } from "./project-session-store"

export interface ProjectSessionRegistry {
  register: (store: ProjectSessionStore) => void
  unregister: (projectId: string) => void
  get: (projectId: string | null | undefined) => ProjectSessionStore | undefined
  setActive: (projectId: string | null) => void
  getActive: () => ProjectSessionStore | undefined
  getAll: () => ProjectSessionStore[]
  subscribe: (listener: () => void) => () => void
  getRevision: () => number
}

export function createProjectSessionRegistry(): ProjectSessionRegistry {
  const sessions = new Map<string, ProjectSessionStore>()
  let activeProjectId: string | null = null
  const listeners = new Set<() => void>()
  const sessionUnsubscribers = new Map<string, () => void>()
  let revision = 0
  const notify = () => {
    revision += 1
    listeners.forEach(listener => listener())
  }

  return {
    register(store) {
      const projectId = store.getState().projectId
      sessionUnsubscribers.get(projectId)?.()
      sessions.set(projectId, store)
      sessionUnsubscribers.set(projectId, store.subscribe(notify))
      notify()
    },
    unregister(projectId) {
      const store = sessions.get(projectId)
      if (!store) return
      store.getState().commands.dispose?.()
      sessionUnsubscribers.get(projectId)?.()
      sessionUnsubscribers.delete(projectId)
      sessions.delete(projectId)
      notify()
    },
    get(projectId) {
      return projectId ? sessions.get(projectId) : undefined
    },
    setActive(projectId) {
      activeProjectId = projectId
    },
    getActive() {
      return activeProjectId ? sessions.get(activeProjectId) : undefined
    },
    getAll() {
      return [...sessions.values()]
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    getRevision() {
      return revision
    },
  }
}

export const projectSessionRegistry = createProjectSessionRegistry()
