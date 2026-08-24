import { createContext, useContext } from "react"

export interface ProjectContextValue {
  workspaceId: string
  cloudMode: boolean
}

export const ProjectContext = createContext<ProjectContextValue | null>(null)

export function useProjectContext(): ProjectContextValue {
  const context = useContext(ProjectContext)
  if (!context) throw new Error("useProjectContext must be inside <ProjectProvider>")
  return context
}
