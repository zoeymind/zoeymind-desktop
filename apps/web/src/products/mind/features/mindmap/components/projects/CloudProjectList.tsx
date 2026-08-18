// @ts-nocheck — cloud/collab type debt; runtime gated by no-op shims
import React, { useCallback, useState, useEffect } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Loader2, PlusIcon } from 'lucide-react'
import { AnimatePresence } from 'motion/react'

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@zoeymind/ui'
import { useOrganization } from '@/shared/app-shared'
import { useTranslation } from '@zoeymind/i18n'

import GridView from './GridView'
import ListView from './ListView'
import { DeleteDialog, RenameDialog } from './dialogs'
import { MoveDialog } from './MoveDialog'
import { useCloudProjects } from './hooks/useCloudProjects'
import type { CloudProjectWithStats } from './hooks/useCloudProjects'
import { ProjectCardSkeleton } from './ProjectCardSkeleton'
import { ProjectListItemSkeleton } from './ProjectListItemSkeleton'

type ViewType = 'grid' | 'list'

interface CloudProjectListProps {
  viewType: ViewType
  searchText: string
  sortType: 'recent' | 'created' | 'name' | 'starred'
  onProjectsChanged?: () => void
  onClearSearch?: () => void
  onProjectCountChange?: (count: number) => void
  onProjectClick?: (project: CloudProjectWithStats) => void
  filter?: 'all' | 'owned' | 'favorited' | 'mine'
  folderId?: string
  /** 当前项目空间 ID; 传了则 mindmap 列表 & 新建都挂在这个 workspace 下 */
  workspaceId?: string | null
}

/**
 * 按当前窗口宽度估算"骨架屏要显示几格"。
 * 提到模块顶层，避免 mount-effect 中 setState 触发的额外一次渲染。
 */
function computeSkeletonColumns(): number {
  if (typeof window === 'undefined') return 12
  const containerWidth = window.innerWidth - 80
  const columns = Math.max(3, Math.floor(containerWidth / 328))
  return columns * 3
}

export const CloudProjectList: React.FC<CloudProjectListProps> = React.memo(
  ({
    viewType,
    searchText,
    sortType,
    onProjectsChanged,
    onClearSearch,
    onProjectCountChange,
    onProjectClick,
    filter = 'all',
    folderId,
    workspaceId
  }) => {
    const { t } = useTranslation()
    const navigate = useNavigate()
    const { currentOrg } = useOrganization()
    const [skeletonColumns, setSkeletonColumns] = useState(() => computeSkeletonColumns())

    // 监听 resize 重新计算；初值在 useState 里同步算出。
    useEffect(() => {
      const recompute = () => setSkeletonColumns(computeSkeletonColumns())
      window.addEventListener('resize', recompute)
      return () => window.removeEventListener('resize', recompute)
    }, [])

    const {
      isAuthenticated,
      projects,
      loading,
      creating,
      renameLoading,
      deleteLoading,
      refreshProjects,
      createProject,
      renameProject,
      deleteProject,
      toggleFavorite
    } = useCloudProjects({
      searchText,
      sortType,
      onProjectsChanged,
      folderId,
      // "我的图" 虚拟视图: 跨 project 展示自己创建的全部, 忽略 workspaceId
      workspaceId: filter === 'mine' ? undefined : workspaceId,
      owner: filter === 'mine' ? 'me' : undefined
    })

    const displayProjects =
      filter === 'owned'
        ? projects.filter(p => p.isOwner)
        : filter === 'favorited'
          ? projects.filter(p => p.isFavorited)
          : projects

    // 通知父组件项目数量变化
    useEffect(() => {
      onProjectCountChange?.(displayProjects.length)
    }, [displayProjects.length, onProjectCountChange])

    const [renameDialogOpen, setRenameDialogOpen] = useState(false)
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
    const [currentProject, setCurrentProject] = useState<CloudProjectWithStats | null>(null)
    const [moveDialogOpen, setMoveDialogOpen] = useState(false)

    const openRenameDialog = useCallback((project: CloudProjectWithStats) => {
      setCurrentProject(project)
      setRenameDialogOpen(true)
    }, [])

    const openDeleteDialog = useCallback((project: CloudProjectWithStats) => {
      setCurrentProject(project)
      setDeleteDialogOpen(true)
    }, [])

    const openMoveDialog = useCallback((project: CloudProjectWithStats) => {
      setCurrentProject(project)
      setMoveDialogOpen(true)
    }, [])

    const handleRenameConfirm = useCallback(
      async (newName: string) => {
        if (!currentProject) return
        await renameProject(currentProject, newName)
        setCurrentProject(prev => (prev ? { ...prev, title: newName, name: newName } : prev))
      },
      [currentProject, renameProject]
    )

    const handleDeleteConfirm = useCallback(async () => {
      if (!currentProject) return
      await deleteProject(currentProject)
      setCurrentProject(null)
    }, [currentProject, deleteProject])

    const handleCreateClick = useCallback(() => {
      createProject()
    }, [createProject])

    const handleToggleFavorite = useCallback(
      (project: CloudProjectWithStats) => {
        toggleFavorite(project).catch(() => {
          // 错误提示同样在 hook 内部处理
        })
      },
      [toggleFavorite]
    )

    const handleRenameOpenChange = useCallback((open: boolean) => {
      setRenameDialogOpen(open)
      if (!open) {
        setCurrentProject(null)
      }
    }, [])

    const handleDeleteOpenChange = useCallback((open: boolean) => {
      setDeleteDialogOpen(open)
      if (!open) {
        setCurrentProject(null)
      }
    }, [])

    if (!isAuthenticated) {
      return (
        <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
          <p className="text-lg mb-4">{t('projects.cloud.needLogin')}</p>
          <Button onClick={() => navigate({ to: '/login' })} variant="outline">
            {t('projects.cloud.login')}
          </Button>
        </div>
      )
    }

    if (loading) {
      // 根据视图类型显示不同的骨架屏
      if (viewType === 'grid') {
        return (
          <div
            className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-7 pb-8 transition-opacity duration-500"
            style={{
              WebkitMaskImage: 'linear-gradient(to bottom, black 50%, transparent 100%)',
              maskImage: 'linear-gradient(to bottom, black 50%, transparent 100%)'
            }}
          >
            {Array.from({ length: skeletonColumns }).map((_, i) => (
              <ProjectCardSkeleton key={i} />
            ))}
          </div>
        )
      } else {
        return (
          <div
            className="space-y-0 transition-opacity duration-500"
            style={{
              WebkitMaskImage: 'linear-gradient(to bottom, black 50%, transparent 100%)',
              maskImage: 'linear-gradient(to bottom, black 50%, transparent 100%)'
            }}
          >
            {Array.from({ length: 12 }).map((_, i) => (
              <ProjectListItemSkeleton key={i} />
            ))}
          </div>
        )
      }
    }

    if (displayProjects.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center flex-1 min-h-[60vh] text-muted-foreground">
          {searchText ? (
            <>
              <p className="text-lg mb-4">{t('projects.cloud.noMatchSearch')}</p>
              <Button onClick={onClearSearch} variant="outline">
                {t('projects.cloud.clearSearch')}
              </Button>
            </>
          ) : filter === 'favorited' ? (
            <p className="text-lg">{t('projects.cloud.favoritedEmpty')}</p>
          ) : folderId ? (
            <p className="text-lg">{t('projects.cloud.folderEmpty')}</p>
          ) : (
            <>
              <p className="text-lg mb-4">{t('projects.cloud.empty')}</p>
              <Button
                onClick={handleCreateClick}
                disabled={creating}
                data-tour="create-first-cloud-project"
              >
                <PlusIcon className="size-4 mr-2" />
                {creating ? t('projects.cloud.creating') : t('projects.cloud.createFirst')}
              </Button>
            </>
          )}
        </div>
      )
    }

    // 默认的项目点击处理：使用传入的 onProjectClick 或导航到新路由
    const handleProjectClick = onProjectClick
      ? (project: CloudProjectWithStats) => onProjectClick(project)
      : async (project: CloudProjectWithStats) => {
          // 桌面端: openTab 到工作区 tab, 不再直接 navigate.
          const { useTabs } = await import('@/shared/tabs/store')
          useTabs.getState().openTab({
            id: project.id,
            kind: 'file',
            title: project.name ?? project.title ?? ''
          })
        }

    return (
      <>
        <AnimatePresence mode="wait" initial={false}>
          {viewType === 'grid' ? (
            <GridView
              key="cloud-grid-view"
              projects={displayProjects}
              onRename={project => openRenameDialog(project as CloudProjectWithStats)}
              onDelete={project => openDeleteDialog(project as CloudProjectWithStats)}
              onToggleFavorite={project => handleToggleFavorite(project as CloudProjectWithStats)}
              onUpdate={() => refreshProjects({ silent: true })}
              onProjectClick={project => handleProjectClick(project as CloudProjectWithStats)}
              onMove={project => openMoveDialog(project as CloudProjectWithStats)}
            />
          ) : (
            <ListView
              key="cloud-list-view"
              projects={displayProjects}
              onRename={project => openRenameDialog(project as CloudProjectWithStats)}
              onDelete={project => openDeleteDialog(project as CloudProjectWithStats)}
              onToggleFavorite={project => handleToggleFavorite(project as CloudProjectWithStats)}
              onUpdate={() => refreshProjects({ silent: true })}
              onProjectClick={project => handleProjectClick(project as CloudProjectWithStats)}
              onMove={project => openMoveDialog(project as CloudProjectWithStats)}
            />
          )}
        </AnimatePresence>

        <RenameDialog
          open={renameDialogOpen}
          onOpenChange={handleRenameOpenChange}
          currentName={currentProject?.title || ''}
          onConfirm={handleRenameConfirm}
          loading={renameLoading}
        />

        <DeleteDialog
          open={deleteDialogOpen}
          onOpenChange={handleDeleteOpenChange}
          itemName={currentProject?.title || ''}
          onConfirm={handleDeleteConfirm}
          loading={deleteLoading}
        />

        <MoveDialog
          open={moveDialogOpen}
          onOpenChange={open => {
            setMoveDialogOpen(open)
            if (!open) setCurrentProject(null)
          }}
          project={currentProject}
          onMoved={() => refreshProjects({ silent: true })}
        />

        {/*
          创建中独立 Dialog —— 与"加载中"全屏 overlay 区分：
          创建在列表层完成；只有拿到真实 id 才会跳转编辑器并显示加载 overlay。
        */}
        <Dialog
          open={creating}
          onOpenChange={(_, details) => {
            // 创建中不允许关闭 (outside-press / escape-key)
            if (details.reason === 'outside-press' || details.reason === 'escape-key') {
              details.cancel()
            }
          }}
        >
          <DialogContent className="sm:max-w-[360px] [&>button]:hidden">
            <DialogHeader className="space-y-3">
              <div className="flex items-center justify-center pt-2">
                <Loader2 className="size-8 animate-spin text-primary" />
              </div>
              <DialogTitle className="text-center">
                {t('projects.actions.creatingTitle')}
              </DialogTitle>
              <DialogDescription className="text-center">
                {t('projects.actions.creatingDesc')}
              </DialogDescription>
            </DialogHeader>
          </DialogContent>
        </Dialog>
      </>
    )
  }
)