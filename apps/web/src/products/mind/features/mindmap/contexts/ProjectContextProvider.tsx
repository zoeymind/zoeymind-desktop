import { useMemo, type ReactNode } from "react"
import { ProjectContext } from "./project-context"

interface ProjectProviderProps {
  workspaceId: string
  cloudMode?: boolean
  children: ReactNode
}

export function ProjectProvider({
  workspaceId,
  cloudMode = false,
  children,
}: ProjectProviderProps) {
  const value = useMemo(() => ({ workspaceId, cloudMode }), [workspaceId, cloudMode])
  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>
}
