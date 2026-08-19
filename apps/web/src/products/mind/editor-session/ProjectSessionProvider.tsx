import { useEffect, useState, type ReactNode } from "react"
import { createProjectSessionStore } from "./project-session-store"
import { projectSessionRegistry } from "./project-session-registry"
import { ProjectSessionContext } from "./project-session-context"

export function ProjectSessionProvider({
  projectId,
  children,
}: {
  projectId: string
  children: ReactNode
}) {
  const [store] = useState(() => createProjectSessionStore(projectId))

  useEffect(() => {
    projectSessionRegistry.register(store)
    return () => projectSessionRegistry.unregister(store.getState().projectId)
  }, [store])

  return <ProjectSessionContext.Provider value={store}>{children}</ProjectSessionContext.Provider>
}
