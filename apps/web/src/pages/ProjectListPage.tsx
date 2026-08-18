/**
 * 桌面端思维导图列表页 —— 本地版。
 *
 * 数据源全部走 SqlProjectRepo / SqlFolderRepo。
 * 磁盘 .zmind 文件缺失时 (`project.exists=false`) 卡片走"失效"分支：
 * 灰边 + 缺预览 + 提示"文件已被移动或删除，右键可从库中移除"。
 *
 * 保留：新建、导入、搜索、按更新时间/名字/星标排序、文件夹侧栏、进入编辑器。
 * 去掉：分享、协作、云快照、组织切换、账号菜单、"分享给我"分类。
 */
import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from '@zoeymind/i18n'
import { Star, Trash2, FolderPlus, Plus, Loader2, AlertTriangle } from 'lucide-react'
import { toast } from '@/shared/app-shared'
import { useProjects } from '@/products/mind/features/mindmap/components/projects/hooks/useProjects'
import { useFolders } from '@/products/mind/features/mindmap/components/projects/hooks/useFolders'
import useProjectStar from '@/products/mind/features/mindmap/components/projects/hooks/useProjectStar'
import { useCreateProject } from '@/products/mind/features/mindmap/components/projects/hooks/useCreateProject'
import { unregisterProject, type ProjectRow } from '@/shared/native'

export function ProjectListPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [activeFolder, setActiveFolder] = useState<string | null | 'all'>('all')

  const projects = useProjects()
  const folders = useFolders()
  const { creating, createBlank } = useCreateProject({
    folderId: activeFolder === 'all' || activeFolder === null ? null : activeFolder,
    onCreated: () => projects.refreshProjects()
  })

  const filtered =
    activeFolder === 'all'
      ? projects.filteredProjects
      : activeFolder === null
        ? projects.filteredProjects.filter(p => !p.folderId)
        : projects.filteredProjects.filter(p => p.folderId === activeFolder)

  const handleNewFolder = useCallback(async () => {
    const name = window.prompt(t('projects.folders.newPlaceholder') ?? '新文件夹')
    if (!name?.trim()) return
    await folders.createFolder(name.trim())
  }, [folders, t])

  const handleUnregister = useCallback(
    async (project: ProjectRow) => {
      const ok = window.confirm(t('projects.confirm.remove') ?? '从库中移除该思维导图？磁盘文件不会被删除。')
      if (!ok) return
      await unregisterProject(project.id)
      await projects.refreshProjects()
      toast.success(t('common.done') ?? '已移除')
    },
    [projects, t]
  )

  return (
    <div className="flex h-full bg-background">
      <aside className="w-56 border-r bg-muted/30 p-3 space-y-1">
        <div className="text-xs font-medium text-muted-foreground px-2 py-1">
          {t('projects.sidebar.libraries') ?? '资料库'}
        </div>
        <FolderRow label={t('projects.sidebar.all') ?? '全部'} active={activeFolder === 'all'} onClick={() => setActiveFolder('all')} />
        <FolderRow label={t('projects.sidebar.uncategorized') ?? '未分类'} active={activeFolder === null} onClick={() => setActiveFolder(null)} />
        <div className="mt-4 flex items-center justify-between px-2">
          <span className="text-xs font-medium text-muted-foreground">
            {t('projects.sidebar.folders') ?? '文件夹'}
          </span>
          <button
            onClick={handleNewFolder}
            className="p-1 hover:bg-muted rounded"
            aria-label={t('projects.folders.new') ?? '新建文件夹'}
          >
            <FolderPlus className="size-3.5" />
          </button>
        </div>
        {folders.folders.map(f => (
          <FolderRow
            key={f.id}
            label={`${f.name} (${f.mindmapCount})`}
            active={activeFolder === f.id}
            onClick={() => setActiveFolder(f.id)}
          />
        ))}
      </aside>

      <main className="flex-1 flex flex-col">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <input
            type="search"
            placeholder={t('projects.search.placeholder') ?? '搜索思维导图...'}
            className="flex-1 max-w-md rounded border bg-background px-3 py-1.5 text-sm"
            value={projects.searchText}
            onChange={e => projects.setSearch(e.target.value)}
          />
          <button
            onClick={() => void createBlank()}
            disabled={creating}
            className="ml-4 inline-flex items-center gap-1.5 rounded bg-primary px-3 py-1.5 text-sm text-primary-foreground disabled:opacity-60"
          >
            {creating ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            {t('projects.actions.newBlank') ?? '新建'}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {projects.loading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <Loader2 className="size-4 animate-spin mr-2" />
              {t('projects.actions.loadingProjects')}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground text-sm">
              {t('projects.empty.hint') ?? '还没有思维导图，点击右上角"新建"开始。'}
            </div>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4">
              {filtered.map(project => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  onOpen={() => navigate(`/editor/${project.id}`)}
                  onRemove={() => handleUnregister(project)}
                  onChanged={() => projects.refreshProjects()}
                />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

function FolderRow({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded px-2 py-1.5 text-sm ${
        active ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted'
      }`}
    >
      {label}
    </button>
  )
}

function ProjectCard({
  project,
  onOpen,
  onRemove,
  onChanged
}: {
  project: ProjectRow
  onOpen: () => void
  onRemove: () => void
  onChanged: () => void
}) {
  const { isStarred, toggleStar } = useProjectStar({ project, onUpdate: onChanged })

  return (
    <div
      className={`group relative rounded-lg border bg-card overflow-hidden ${
        project.exists ? 'hover:shadow-md cursor-pointer' : 'opacity-60 border-dashed'
      }`}
      onClick={project.exists ? onOpen : undefined}
      role="button"
      tabIndex={0}
    >
      <div className="aspect-video bg-muted flex items-center justify-center text-muted-foreground">
        {project.exists ? (
          <span className="text-xs">preview</span>
        ) : (
          <div className="flex items-center gap-1.5 text-destructive text-xs">
            <AlertTriangle className="size-4" />
            <span>文件缺失</span>
          </div>
        )}
      </div>
      <div className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate font-medium text-sm">{project.name}</div>
            <div className="truncate text-xs text-muted-foreground mt-0.5">{project.path}</div>
          </div>
          <button
            onClick={toggleStar}
            className="p-1 opacity-60 hover:opacity-100"
            aria-label="star"
          >
            <Star className={`size-4 ${isStarred ? 'fill-yellow-400 text-yellow-400' : ''}`} />
          </button>
        </div>
        <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
          <span>{new Date(project.updatedAt).toLocaleDateString()}</span>
          <button
            onClick={e => {
              e.stopPropagation()
              onRemove()
            }}
            className="opacity-0 group-hover:opacity-100 hover:text-destructive"
            aria-label="remove"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}
