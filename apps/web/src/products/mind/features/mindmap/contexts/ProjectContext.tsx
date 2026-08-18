import { createContext, useContext, ReactNode } from 'react'
import { logger } from '@zoeymind/logger'

interface ProjectContextValue {
  workspaceId: string
  cloudMode: boolean
}

const ProjectContext = createContext<ProjectContextValue | null>(null)

/**
 * ProjectProvider - 为 MindMap 页面提供项目级作用域
 *
 * 通过 Context 注入 workspaceId 和 cloudMode 到页面范围
 * 当 workspaceId 变化时,整个 Provider 会重新挂载(通过 key={workspaceId})
 * 所有子组件会自动重新初始化,实现状态隔离
 */
export function ProjectProvider({
  workspaceId,
  cloudMode,
  children
}: {
  workspaceId: string
  cloudMode: boolean
  children: ReactNode
}) {
  logger.debug('ProjectProvider: 初始化', { workspaceId, cloudMode })

  return (
    <ProjectContext.Provider value={{ workspaceId, cloudMode }}>{children}</ProjectContext.Provider>
  )
}

/**
 * useProjectContext - 获取当前页面的项目上下文
 *
 * @returns { workspaceId, cloudMode }
 * @throws 如果在 ProjectProvider 外部使用会抛出错误
 */
export function useProjectContext(): ProjectContextValue {
  const context = useContext(ProjectContext)
  if (!context) {
    throw new Error('useProjectContext must be used within ProjectProvider')
  }
  return context
}
