/**
 * useProjects —— 桌面端本地版：从 SqlProjectRepo 读，按搜索/排序过滤。
 *
 * 与产品仓的原实现（走 IDB projectDB.getProjectsWithStats + useProjectManager
 * refreshStats）表面尽量兼容，返回 { projects, filteredProjects, loading,
 * searchText, sortType, setSearch, clearSearch, refreshProjects, handleSortChange }。
 *
 * 桌面端每条记录多带 `exists` 位（对应磁盘 .zmind 是否存在），
 * 消费方（ProjectCard / ProjectListItem）据此渲染失效卡片。
 */
import { useState, useEffect, useMemo, useCallback } from 'react'
import { logger } from '@zoeymind/logger'
import { i18next } from '@zoeymind/i18n'
import { useLoading } from '@/shared/app-shared'
import { listProjects, type ProjectRow } from '@/shared/native'

export type SortType = 'recent' | 'created' | 'name' | 'starred'

export function useProjects() {
  const [projects, setProjects] = useState<ProjectRow[]>([])
  const [loading, setLoading] = useState(true)
  const [searchText, setSearchText] = useState('')
  const [sortType, setSortType] = useState<SortType>('recent')
  const { showLoading, hideLoading } = useLoading()

  useEffect(() => {
    const controller = { isMounted: true }

    const run = async () => {
      if (!controller.isMounted) return
      setLoading(true)
      try {
        showLoading(i18next.t('projects.actions.loadingProjects'))
        const rows = await listProjects()
        if (controller.isMounted) {
          setProjects(rows)
        }
      } catch (error) {
        logger.error('加载项目失败:', error)
      } finally {
        if (controller.isMounted) {
          setLoading(false)
          hideLoading()
        }
      }
    }

    run()

    return () => {
      controller.isMounted = false
    }
  }, [showLoading, hideLoading])

  const refreshProjects = useCallback(async () => {
    try {
      const rows = await listProjects()
      setProjects(rows)
    } catch (error) {
      logger.error('刷新项目列表失败:', error)
    }
  }, [])

  const setSearch = useCallback((text: string) => setSearchText(text), [])
  const clearSearch = useCallback(() => setSearchText(''), [])
  const handleSortChange = useCallback((sortKey: string) => setSortType(sortKey as SortType), [])

  const filteredAndSortedProjects = useMemo(() => {
    const q = searchText.toLowerCase()
    const filtered = q ? projects.filter(p => p.name.toLowerCase().includes(q)) : projects.slice()

    return filtered.sort((a, b) => {
      if (sortType === 'starred') {
        const diff = (b.isStarred ? 1 : 0) - (a.isStarred ? 1 : 0)
        if (diff !== 0) return diff
        return b.updatedAt - a.updatedAt
      }
      switch (sortType) {
        case 'recent':
          return b.updatedAt - a.updatedAt
        case 'created':
          return b.createdAt - a.createdAt
        case 'name':
          return a.name.localeCompare(b.name)
        default:
          return 0
      }
    })
  }, [projects, searchText, sortType])

  return {
    projects,
    filteredProjects: filteredAndSortedProjects,
    loading,
    searchText,
    sortType,
    setSearch,
    clearSearch,
    refreshProjects,
    handleSortChange
  }
}

export default useProjects
