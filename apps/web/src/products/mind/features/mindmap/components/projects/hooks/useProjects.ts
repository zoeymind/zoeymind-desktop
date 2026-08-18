import { logger } from '@zoeymind/logger'
import { useState, useEffect, useMemo, useCallback } from 'react'
import { i18next } from '@zoeymind/i18n'
import { projectDB, type ProjectWithStats } from '@/shared/mindmap-bridge'
import { useLoading } from '@/shared/app-shared'
import { useProjectManager } from '@/shared/mindmap-bridge'

// 排序类型
export type SortType = 'recent' | 'created' | 'name' | 'starred'

/**
 * 项目列表管理hook
 * 处理项目列表的加载、过滤和排序
 *
 * @returns 项目列表相关状态和方法
 */
export function useProjects() {
  const [projects, setProjects] = useState<ProjectWithStats[]>([])
  const [loading, setLoading] = useState(true)
  const [searchText, setSearchText] = useState('')
  const [sortType, setSortType] = useState<SortType>('recent')
  const { showLoading, hideLoading } = useLoading()

  // 加载项目列表
  useEffect(() => {
    // 使用引用类型保存loadProjects，以避免被不必要的重新创建
    const controller = {
      isMounted: true
    }

    const loadProjects = async () => {
      if (!controller.isMounted) return
      setLoading(true)
      try {
        // 显示全局加载状态
        showLoading(i18next.t('projects.actions.loadingProjects'))

        // 清除统计信息缓存强制刷新，但只在某些情况下执行
        // 原代码中强制刷新会导致每次加载都重新更新元数据
        await projectDB.getProjects()
        // 不再遍历清除缓存，减少不必要的更新

        // 获取带统计信息的项目列表
        const projectsWithStats = await projectDB.getProjectsWithStats()
        if (controller.isMounted) {
          setProjects(projectsWithStats)
        }

        // 获取项目统计管理器，一次性刷新所有项目统计
        const projectManager = useProjectManager.getState()
        for (const project of projectsWithStats) {
          projectManager.refreshProjectStats(project.id)
        }
      } catch (error) {
        logger.error('加载项目失败:', error)
      } finally {
        if (controller.isMounted) {
          setLoading(false)
          // 隐藏全局加载状态
          hideLoading()
        }
      }
    }

    loadProjects()

    // 清理函数
    return () => {
      controller.isMounted = false
    }
  }, [showLoading, hideLoading]) // 确保依赖项正确

  // 刷新项目列表
  const refreshProjects = useCallback(async () => {
    try {
      const projectsWithStats = await projectDB.getProjectsWithStats()
      setProjects(projectsWithStats)

      // 刷新项目统计信息
      const projectManager = useProjectManager.getState()
      for (const project of projectsWithStats) {
        projectManager.refreshProjectStats(project.id)
      }
    } catch (error) {
      logger.error('刷新项目列表失败:', error)
    }
  }, [])

  // 设置搜索文本
  const setSearch = useCallback((text: string) => {
    setSearchText(text)
  }, [])

  // 清除搜索
  const clearSearch = useCallback(() => {
    setSearchText('')
  }, [])

  // 处理排序变更
  const handleSortChange = useCallback((sortKey: string) => {
    setSortType(sortKey as SortType)
  }, [])

  // 过滤和排序项目
  const filteredAndSortedProjects = useMemo(() => {
    // 过滤项目
    const filtered = projects.filter(
      project =>
        project.name.toLowerCase().includes(searchText.toLowerCase()) ||
        (project.description &&
          project.description.toLowerCase().includes(searchText.toLowerCase()))
    )

    // 然后排序
    return filtered.sort((a, b) => {
      // 只在"星标"排序模式下优先显示收藏项目
      if (sortType === 'starred') {
        const aStarred = a.metadata?.starred ? 1 : 0
        const bStarred = b.metadata?.starred ? 1 : 0

        // 如果星标状态不同，星标的排在前面
        if (aStarred !== bStarred) {
          return bStarred - aStarred
        }

        // 星标相同时，按更新时间排序
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      }

      // 按选定的排序类型
      switch (sortType) {
        case 'recent':
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        case 'created':
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        case 'name':
          return a.name.localeCompare(b.name)
        default:
          return 0
      }
    })
  }, [projects, searchText, sortType])

  return {
    projects, // 原始项目列表
    filteredProjects: filteredAndSortedProjects, // 过滤和排序后的项目
    loading, // 加载状态
    searchText, // 搜索文本
    sortType, // 排序类型
    setSearch, // 设置搜索文本
    clearSearch, // 清除搜索
    refreshProjects, // 刷新项目列表
    handleSortChange // 处理排序变更
  }
}

export default useProjects
