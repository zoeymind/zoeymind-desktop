/**
 * ProjectContext —— 从产品仓原版恢复，保留 { workspaceId, cloudMode } 接口。
 * 桌面端 cloudMode 恒 false，但 API 保持一致方便老组件 destructure。
 */
import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { logger } from '@zoeymind/logger'

interface ProjectContextValue {
  workspaceId: string
  cloudMode: boolean
}

const ProjectContext = createContext<ProjectContextValue | null>(null)

interface ProjectProviderProps {
  workspaceId: string
  cloudMode?: boolean
  children: ReactNode
}

export function ProjectProvider({ workspaceId, cloudMode = false, children }: ProjectProviderProps) {
  logger.debug('ProjectProvider: 初始化', { workspaceId, cloudMode })
  const value = useMemo(() => ({ workspaceId, cloudMode }), [workspaceId, cloudMode])
  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>
}

export function useProjectContext(): ProjectContextValue {
  const ctx = useContext(ProjectContext)
  if (!ctx) throw new Error('useProjectContext must be inside <ProjectProvider>')
  return ctx
}
