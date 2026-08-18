import { useCallback, useEffect, useMemo, useState } from 'react'
import { logger } from '@zoeymind/logger'

import { useAuth } from '@/shared/auth'
import { useOrganization } from '@/shared/app-shared'
import { trpcClient } from '@/shared/app-shared'
import { toast } from '@/shared/app-shared'
import { i18next } from '@zoeymind/i18n'
import type { MindmapRole } from '@zoeymind/shared'

import type { SortType } from './useProjects'
import { useCreateProject } from './useCreateProject'

interface CloudProjectCreator {
  id: string
  name: string
  avatar?: string
}

interface CloudProject {
  id: string
  title: string
  description?: string
  tags: string[]
  nodeCount: number
  createdAt: Date
  updatedAt: Date
  isFavorited: boolean
  creator: CloudProjectCreator
  // 用户对该 mindmap 的协作角色 (与 API 返回字段名一致):
  //   'OWNER' | 'EDITOR' | 'VIEWER' | null
  // 由 mindmap.list?.userRole 直传, 前端判定统一走 canWriteMindmap(role).
  userRole: MindmapRole | null
  isOwner: boolean
  sharedAt?: Date | null
  hasExternalAccess?: boolean
}

export interface CloudProjectWithStats extends CloudProject {
  folderId?: string | null
  /** 所属 workspace / project id (来自 mindmap.workspaceId). */
  workspaceId?: string | null
  name: string
  isArchived: boolean
  owner: string
  previewUrl?: string
  icon?: string
  collaborators?: string[]
  metadata?: Record<string, unknown>
  stats: {
    conversationCount: number
    messageCount: number
    lastActive?: Date
    nodeCount: number
    lastModified: Date
    size: number
  }
}

interface UseCloudProjectsOptions {
  searchText: string
  sortType: SortType
  onProjectsChanged?: () => void
  folderId?: string
  /** 当前项目空间 ID; 传了则 mindmap 列表按此 workspace 过滤 */
  workspaceId?: string | null
  /**
   * 我的图过滤:
   *   - 'me':    只看 createdBy=me
   *   - 'other': 只看非我创建 (共享给我)
   *   - undefined: 不按 owner 过滤
   */
  owner?: 'me' | 'other'
  /** true → 强制过滤 workspaceId IS NULL (我的未发布图) */
  nullProjectOnly?: boolean
}

interface FetchOptions {
  silent?: boolean
  search?: string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- 后端返回的数据结构尚未定义 TS 类型
const mapMindmapToCloudProject = (mindmap: any): CloudProjectWithStats => {
  const createdAt = new Date(mindmap.createdAt)
  const updatedAt = new Date(mindmap.updatedAt)

  return {
    id: mindmap.id,
    title: mindmap.title,
    name: mindmap.title,
    description: mindmap.description || undefined,
    tags: mindmap.tags ?? [],
    nodeCount: mindmap.nodeCount ?? 0,
    previewUrl: mindmap.previewData,
    createdAt,
    updatedAt,
    isFavorited: Boolean(mindmap.isFavorited),
    creator: mindmap.creator,
    // 用户对该 mindmap 的协作角色, 直接透传后端 userRole ('VIEWER'|'EDITOR'|'OWNER'|null)
    userRole: (mindmap.userRole ?? null) as MindmapRole | null,
    isOwner: Boolean(mindmap.isOwner),
    sharedAt: mindmap.sharedAt ? new Date(mindmap.sharedAt) : null,
    hasExternalAccess: Boolean(mindmap.hasExternalAccess),
    folderId: mindmap.folderId ?? null,
    workspaceId: mindmap.workspaceId ?? null,
    isArchived: false,
    owner: mindmap.createdBy,
    icon: undefined,
    collaborators: undefined,
    metadata: undefined,
    stats: {
      conversationCount: mindmap.conversationCount ?? 0,
      messageCount: mindmap.messageCount ?? 0,
      lastActive: updatedAt,
      nodeCount: mindmap.nodeCount ?? 0,
      lastModified: updatedAt,
      size: (mindmap.nodeCount ?? 0) * 50
    }
  }
}

const filterAndSortProjects = (
  projects: CloudProjectWithStats[],
  searchText: string,
  sortType: SortType
) => {
  let filtered = [...projects]

  if (searchText) {
    const searchLower = searchText.toLowerCase()
    filtered = filtered.filter(project => {
      const matchesTitle = project.title.toLowerCase().includes(searchLower)
      const matchesDescription = project.description
        ? project.description.toLowerCase().includes(searchLower)
        : false
      const matchesTag = project.tags.some(tag => tag.toLowerCase().includes(searchLower))

      return matchesTitle || matchesDescription || matchesTag
    })
  }

  filtered.sort((a, b) => {
    switch (sortType) {
      case 'recent':
        return b.updatedAt.getTime() - a.updatedAt.getTime()
      case 'created':
        return b.createdAt.getTime() - a.createdAt.getTime()
      case 'name':
        return a.title.localeCompare(b.title)
      case 'starred':
        if (a.isFavorited && !b.isFavorited) return -1
        if (!a.isFavorited && b.isFavorited) return 1
        return b.updatedAt.getTime() - a.updatedAt.getTime()
      default:
        return 0
    }
  })

  return filtered
}

export function useCloudProjects({
  searchText,
  sortType,
  onProjectsChanged,
  folderId,
  workspaceId,
  owner,
  nullProjectOnly
}: UseCloudProjectsOptions) {
  const { isAuthenticated } = useAuth()
  const { currentOrg } = useOrganization()

  const [projects, setProjects] = useState<CloudProjectWithStats[]>([])
  const [loading, setLoading] = useState(false)
  const [renameLoading, setRenameLoading] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const fetchProjects = useCallback(
    async ({ silent = false, search = searchText }: FetchOptions = {}) => {
      if (!isAuthenticated || !currentOrg) {
        setProjects([])
        setLoading(false)
        return [] as CloudProjectWithStats[]
      }

      if (!silent) {
        setLoading(true)
      }

      try {
        const response = await trpcClient.mindmap.list.query({
          page: 1,
          limit: 50,
          search: search ? search : undefined,
          organizationId: currentOrg.id,
          folderId,
          workspaceId: nullProjectOnly ? 'null' : (workspaceId ?? undefined),
          owner
        })

        const mapped = response.data.map(mapMindmapToCloudProject)
        setProjects(mapped)
        return mapped
      } catch (error) {
        logger.error('加载云项目失败:', error)
        if (!silent) {
          setProjects([])
        }
        return [] as CloudProjectWithStats[]
      } finally {
        if (!silent) {
          setLoading(false)
        }
      }
    },
    [isAuthenticated, searchText, currentOrg, folderId, workspaceId, owner, nullProjectOnly]
  )

  useEffect(() => {
    const timeoutId = setTimeout(
      () => {
        fetchProjects({ silent: Boolean(searchText), search: searchText })
      },
      searchText ? 300 : 0
    )

    return () => {
      clearTimeout(timeoutId)
    }
  }, [fetchProjects, searchText])

  const refreshProjects = useCallback(
    async ({ silent = true }: { silent?: boolean } = {}) => {
      await fetchProjects({ silent, search: searchText })
    },
    [fetchProjects, searchText]
  )

  // 复用通用 hook：列表层入口（"首个项目"按钮）与 header NewProjectMenu 走同一份逻辑。
  const { creating, createBlank } = useCreateProject({ onCreated: onProjectsChanged, workspaceId })
  const createProject = createBlank

  const renameProject = useCallback(
    async (project: CloudProjectWithStats, newName: string) => {
      const trimmed = newName.trim()
      if (!trimmed) {
        toast({
          title: i18next.t('projects.actions.renameFailedTitle'),
          description: i18next.t('projects.actions.renameEmptyName'),
          variant: 'destructive'
        })
        return
      }

      setRenameLoading(true)
      try {
        await trpcClient.mindmap.update.mutate({
          mindmapId: project.id,
          title: trimmed
        })

        await refreshProjects({ silent: true })
        onProjectsChanged?.()

        toast({
          description: i18next.t('projects.actions.renameSuccessDesc', { value: trimmed }),
          variant: 'success'
        })
      } catch (error) {
        logger.error('重命名云项目失败:', error)
        toast({
          title: i18next.t('projects.actions.renameFailedTitle'),
          description:
            error instanceof Error ? error.message : i18next.t('projects.actions.renameFailedDesc'),
          variant: 'destructive'
        })
        throw error instanceof Error
          ? error
          : new Error(i18next.t('mindmap.toast.renameCloudProjectFailed'))
      } finally {
        setRenameLoading(false)
      }
    },
    [onProjectsChanged, refreshProjects]
  )

  const deleteProject = useCallback(
    async (project: CloudProjectWithStats) => {
      setDeleteLoading(true)
      try {
        await trpcClient.mindmap.delete.mutate({ mindmapId: project.id })

        await refreshProjects({ silent: true })
        onProjectsChanged?.()

        toast({
          description: i18next.t('projects.actions.deleteSuccessDesc', { value: project.title }),
          variant: 'success'
        })
      } catch (error) {
        logger.error('删除云项目失败:', error)
        toast({
          title: i18next.t('projects.actions.deleteFailedTitle'),
          description:
            error instanceof Error ? error.message : i18next.t('projects.actions.deleteFailedDesc'),
          variant: 'destructive'
        })
        throw error instanceof Error
          ? error
          : new Error(i18next.t('mindmap.toast.deleteCloudProjectFailed'))
      } finally {
        setDeleteLoading(false)
      }
    },
    [onProjectsChanged, refreshProjects]
  )

  const toggleFavorite = useCallback(async (project: CloudProjectWithStats) => {
    try {
      const newFavoriteStatus = !project.isFavorited

      await trpcClient.mindmap.update.mutate({
        mindmapId: project.id,
        isFavorite: newFavoriteStatus
      })

      setProjects(prev =>
        prev.map(item =>
          item.id === project.id ? { ...item, isFavorited: newFavoriteStatus } : item
        )
      )

      toast({
        description: newFavoriteStatus
          ? i18next.t('projects.actions.favoritedDesc', { value: project.title })
          : i18next.t('projects.actions.unfavoritedDesc', { value: project.title }),
        variant: 'success'
      })

      return newFavoriteStatus
    } catch (error) {
      logger.error('切换收藏状态失败:', error)
      toast({
        title: i18next.t('projects.actions.favoriteToggleFailedTitle'),
        description:
          error instanceof Error
            ? error.message
            : i18next.t('projects.actions.favoriteToggleFailedDesc'),
        variant: 'destructive'
      })
      throw error instanceof Error
        ? error
        : new Error(i18next.t('mindmap.toast.toggleFavoriteFailed'))
    }
  }, [])

  const filteredProjects = useMemo(
    () => filterAndSortProjects(projects, searchText, sortType),
    [projects, searchText, sortType]
  )

  return {
    isAuthenticated,
    projects: filteredProjects,
    loading,
    creating,
    renameLoading,
    deleteLoading,
    refreshProjects,
    createProject,
    renameProject,
    deleteProject,
    toggleFavorite
  }
}

export type UseCloudProjectsReturn = ReturnType<typeof useCloudProjects>
