// @ts-nocheck — cloud/collab-heavy legacy; runtime behavior gated by no-op shims
import { useQuery } from '@tanstack/react-query'
import { trpcClient } from '@/shared/app-shared'
import { logger } from '@zoeymind/logger'

/**
 * 项目信息缓存 Hook
 * 避免多个组件重复调用 mindmap.getById
 */
export function useProjectInfo(workspaceId?: string) {
  return useQuery({
    queryKey: ['projectInfo', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return null

      try {
        const response = await trpcClient.mindmap.getById.query({ mindmapId: workspaceId })
        return response.success ? response.mindmap : null
      } catch (error) {
        logger.error('获取项目信息失败:', error)
        throw error
      }
    },
    enabled: !!workspaceId,
    staleTime: 5 * 60 * 1000, // 5分钟缓存
    gcTime: 10 * 60 * 1000, // 10分钟缓存
    retry: 2
  })
}

/**
 * 项目主题信息 Hook
 */
export function useProjectTheme(workspaceId?: string) {
  const { data: projectInfo, isLoading, error } = useProjectInfo(workspaceId)

  return {
    theme: projectInfo && 'theme' in projectInfo ? projectInfo.theme || null : null,
    isLoading,
    error
  }
}

/**
 * 项目标题信息 Hook
 */
export function useProjectTitle(workspaceId?: string) {
  const { data: projectInfo, isLoading, error } = useProjectInfo(workspaceId)

  return {
    title: projectInfo && 'title' in projectInfo ? projectInfo.title || '' : '',
    isLoading,
    error
  }
}