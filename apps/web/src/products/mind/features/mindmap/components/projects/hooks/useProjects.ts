/**
 * useProjects —— 桌面端本地版：SqlProjectRepo。表面对齐原产品版。
 */
import { useState, useEffect, useMemo, useCallback } from 'react'
import { logger } from '@zoeymind/logger'
import { i18next } from '@zoeymind/i18n'
import { useLoading } from '@/shared/app-shared'
import { listProjects, type ProjectRow } from '@/shared/native'

export type SortType = 'recent' | 'created' | 'name' | 'starred'

/**
 * 兼容原 ProjectWithStats 消费者：把 SqlProjectRepo 的 ProjectRow 映射成
 * 原 shape（updatedAt/createdAt 为 Date，metadata.starred，stats.nodeCount）
 */
export interface ProjectWithStats {
  id: string
  name: string
  path: string
  description?: string
  updatedAt: Date
  createdAt: Date
  exists: boolean
  metadata: { starred: boolean; tags: string[] }
  stats: { nodeCount: number; size: number }
}

function toWithStats(row: ProjectRow): ProjectWithStats {
  return {
    id: row.id,
    name: row.name,
    path: row.path,
    updatedAt: new Date(row.updatedAt),
    createdAt: new Date(row.createdAt),
    exists: row.exists,
    metadata: { starred: row.isStarred, tags: row.tags },
    stats: { nodeCount: row.nodeCount, size: row.size }
  }
}

export function useProjects() {
  const [projects, setProjects] = useState<ProjectWithStats[]>([])
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
        if (controller.isMounted) setProjects(rows.map(toWithStats))
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
      setProjects(rows.map(toWithStats))
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
        const diff = (b.metadata.starred ? 1 : 0) - (a.metadata.starred ? 1 : 0)
        if (diff !== 0) return diff
        return b.updatedAt.getTime() - a.updatedAt.getTime()
      }
      switch (sortType) {
        case 'recent':
          return b.updatedAt.getTime() - a.updatedAt.getTime()
        case 'created':
          return b.createdAt.getTime() - a.createdAt.getTime()
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
