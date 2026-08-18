import React, { useEffect, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { AnimatePresence } from 'motion/react'
import { useTranslation } from '@zoeymind/i18n'
import { trpc } from '@/shared/app-shared'
import { Button } from '@zoeymind/ui'
import GridView from './GridView'
import ListView from './ListView'
import { CloudProjectWithStats } from './hooks/useCloudProjects'
import { ProjectCardSkeleton } from './ProjectCardSkeleton'
import { ProjectListItemSkeleton } from './ProjectListItemSkeleton'

type ViewType = 'grid' | 'list'

interface SharedWithMeListProps {
  viewType: ViewType
  searchText: string
}

type SharedProject = CloudProjectWithStats & {
  organizationId: string
  createdBy: string
  workspaceId: string | null
  projectName: string | null
}

interface SharedGroup {
  key: string
  projectName: string | null
  items: SharedProject[]
  latestUpdatedAt: number
}

function buildGroups(items: SharedProject[]): SharedGroup[] {
  const OTHER_KEY = '__other__'
  const byKey = new Map<string, SharedGroup>()
  for (const it of items) {
    const key = it.workspaceId ?? OTHER_KEY
    const projectName = it.workspaceId ? (it.projectName ?? null) : null
    const bucket = byKey.get(key)
    const ts = it.updatedAt ? new Date(it.updatedAt).getTime() : 0
    if (bucket) {
      bucket.items.push(it)
      if (ts > bucket.latestUpdatedAt) bucket.latestUpdatedAt = ts
    } else {
      byKey.set(key, { key, projectName, items: [it], latestUpdatedAt: ts })
    }
  }
  // 分组内按 updatedAt 倒序 (最近变更靠前)
  for (const g of byKey.values()) {
    g.items.sort((a, b) => {
      const at = a.updatedAt ? new Date(a.updatedAt).getTime() : 0
      const bt = b.updatedAt ? new Date(b.updatedAt).getTime() : 0
      return bt - at
    })
  }
  // 分组间按各自最新 updatedAt 倒序; '其他' 分组一律最后.
  const groups = Array.from(byKey.values())
  const other = groups.filter(g => g.key === OTHER_KEY)
  const rest = groups
    .filter(g => g.key !== OTHER_KEY)
    .sort((a, b) => b.latestUpdatedAt - a.latestUpdatedAt)
  return [...rest, ...other]
}

function computeSkeletonColumns(): number {
  if (typeof window === 'undefined') return 12
  return Math.max(3, Math.floor((window.innerWidth - 80) / 328)) * 3
}

function isValidSharedProject(p: unknown): p is SharedProject {
  return (
    p !== null &&
    typeof p === 'object' &&
    'id' in p &&
    'title' in p &&
    'organizationId' in p &&
    'createdBy' in p
  )
}

export const SharedWithMeList: React.FC<SharedWithMeListProps> = React.memo(
  ({ viewType, searchText }) => {
    const { t } = useTranslation()
    const navigate = useNavigate()
    const [skeletonColumns, setSkeletonColumns] = useState(() => computeSkeletonColumns())

    useEffect(() => {
      const recompute = () => setSkeletonColumns(computeSkeletonColumns())
      window.addEventListener('resize', recompute)
      return () => window.removeEventListener('resize', recompute)
    }, [])

    const sharedQuery = trpc.mindmap.listSharedWithMe.useQuery()
    const { data, isLoading } = sharedQuery

    const typedProjects = ((data?.data ?? []) as unknown[]).filter(isValidSharedProject)
    const projects: SharedProject[] = typedProjects
      .filter(
        p =>
          p.title.toLowerCase().includes(searchText.toLowerCase()) ||
          (p.description && p.description.toLowerCase().includes(searchText.toLowerCase()))
      )
      .map(
        p =>
          ({
            ...p,
            name: p.title,
            isArchived: false,
            owner: p.createdBy,
            // 直接透传后端 userRole ('VIEWER'|'EDITOR'|'OWNER'|null),
            // ProjectCard / ProjectListItem 用 canWriteMindmap(role) 判定徽章.
            userRole:
              (p as unknown as { userRole?: 'VIEWER' | 'EDITOR' | 'OWNER' | null }).userRole ??
              null,
            stats: {
              conversationCount: 0,
              messageCount: 0,
              lastActive: undefined,
              nodeCount: p.nodeCount || 0,
              lastModified: p.updatedAt,
              size: 0
            }
          }) as unknown as SharedProject
      )

    const handleProjectClick = (project: SharedProject) => {
      navigate({
        to: '/org/$orgId/zoeymind/editor/$id',
        params: { orgId: project.organizationId, id: project.id }
      })
    }

    if (isLoading) {
      return (
        <div
          className={`${viewType === 'grid' ? 'grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))]' : 'space-y-0'} gap-7 pb-8 transition-opacity duration-500`}
          style={{
            WebkitMaskImage: 'linear-gradient(to bottom, black 50%, transparent 100%)',
            maskImage: 'linear-gradient(to bottom, black 50%, transparent 100%)'
          }}
        >
          {Array.from({ length: viewType === 'grid' ? skeletonColumns : 12 }).map((_, i) =>
            viewType === 'grid' ? (
              <ProjectCardSkeleton key={i} />
            ) : (
              <ProjectListItemSkeleton key={i} />
            )
          )}
        </div>
      )
    }

    if (projects.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
          {searchText ? (
            <>
              <p className="text-lg mb-4">{t('projects.cloud.noMatchSearch')}</p>
              <Button onClick={() => window.location.reload()} variant="outline">
                {t('projects.cloud.clearSearch')}
              </Button>
            </>
          ) : (
            <p className="text-lg">{t('projects.shared.empty')}</p>
          )}
        </div>
      )
    }

    // 按 project 分组 — 同 org 的分享按 project 归拢, workspaceId=null / 跨 org 直接邀请
    // 归到 "其他分享" fallback 分组; 分组内按 updatedAt 倒序; 分组间按各自最新 updatedAt 倒序.
    const groups = buildGroups(projects)

    return (
      <AnimatePresence mode="wait" initial={false}>
        <div key={viewType === 'grid' ? 'shared-grid' : 'shared-list'} className="space-y-8 pb-8">
          {groups.map(g => (
            <section key={g.key}>
              <header className="mb-3 flex items-center gap-2 text-sm">
                <h3 className="font-semibold text-foreground">
                  {g.projectName ?? t('projects.shared.groupOther')}
                </h3>
                <span className="text-muted-foreground">
                  {t('projects.shared.groupCount', { count: g.items.length })}
                </span>
              </header>
              {viewType === 'grid' ? (
                <GridView
                  projects={g.items}
                  onRename={() => {}}
                  onDelete={() => {}}
                  onToggleFavorite={() => {}}
                  onUpdate={() => sharedQuery.refetch()}
                  onProjectClick={project =>
                    handleProjectClick(project as unknown as SharedProject)
                  }
                />
              ) : (
                <ListView
                  projects={g.items}
                  onRename={() => {}}
                  onDelete={() => {}}
                  onToggleFavorite={() => {}}
                  onUpdate={() => sharedQuery.refetch()}
                  onProjectClick={project =>
                    handleProjectClick(project as unknown as SharedProject)
                  }
                />
              )}
            </section>
          ))}
        </div>
      </AnimatePresence>
    )
  }
)

SharedWithMeList.displayName = 'SharedWithMeList'
