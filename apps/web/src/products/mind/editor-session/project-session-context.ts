import { createContext, useContext } from "react"
import { useStore } from "zustand"
import type { ProjectSessionState, ProjectSessionStore } from "./project-session-store"

export const ProjectSessionContext = createContext<ProjectSessionStore | null>(null)

export function useProjectSessionStore(): ProjectSessionStore {
  const store = useContext(ProjectSessionContext)
  if (!store) {
    throw new Error("useProjectSessionStore must be used inside ProjectSessionProvider")
  }
  return store
}

export function useProjectSession<T>(selector: (state: ProjectSessionState) => T): T {
  return useStore(useProjectSessionStore(), selector)
}
