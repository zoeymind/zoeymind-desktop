/**
 * ProjectContext —— 桌面端只承载"当前打开的 .zmind 项目标识"。
 *
 * 云版本还带 cloudMode / permission；桌面端一律本地，去掉。
 * `projectId` = SqlProjectRepo 里的 id；`path` = 磁盘绝对路径（读/写 .zmind）。
 */
import { createContext, useContext, useMemo, type ReactNode } from 'react'

interface ProjectContextValue {
  /** 兼容原编辑器 hook 里的 `workspaceId` 命名，实际语义 = projectId。 */
  workspaceId: string
  path: string | null
}

const ProjectContext = createContext<ProjectContextValue | null>(null)

interface ProjectProviderProps {
  workspaceId: string
  path: string | null
  children: ReactNode
}

export function ProjectProvider({ workspaceId, path, children }: ProjectProviderProps) {
  const value = useMemo(() => ({ workspaceId, path }), [workspaceId, path])
  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>
}

export function useProjectContext(): ProjectContextValue {
  const ctx = useContext(ProjectContext)
  if (!ctx) throw new Error('useProjectContext must be inside <ProjectProvider>')
  return ctx
}
