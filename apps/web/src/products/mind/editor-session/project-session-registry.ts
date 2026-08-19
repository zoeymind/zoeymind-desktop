import type { ProjectSessionStore } from "./project-session-store"

export interface ProjectSessionRegistry {
  register: (store: ProjectSessionStore) => void
  unregister: (projectId: string) => void
  get: (projectId: string | null | undefined) => ProjectSessionStore | undefined
  setActive: (projectId: string | null) => void
  getActive: () => ProjectSessionStore | undefined
  getAll: () => ProjectSessionStore[]
}

export function createProjectSessionRegistry(): ProjectSessionRegistry {
  const sessions = new Map<string, ProjectSessionStore>()
  let activeProjectId: string | null = null

  return {
    register(store) {
      sessions.set(store.getState().projectId, store)
    },
    unregister(projectId) {
      const store = sessions.get(projectId)
      if (!store) return
      store.getState().commands.dispose?.()
      sessions.delete(projectId)
      if (activeProjectId === projectId) activeProjectId = null
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
  }
}

export const projectSessionRegistry = createProjectSessionRegistry()
