import { createBrowserRouter, Navigate, useNavigate, useParams } from 'react-router-dom'
import { useCallback, useEffect, useRef, useState } from 'react'
import { PanelLeft } from 'lucide-react'
import { MainLayout } from '@/components/layouts/main-layout'
import { ProjectListPage } from '@/products/mind/features/mindmap/pages/ProjectsPage'
import {
  ProjectsSidebar,
  type ProjectView
} from '@/products/mind/features/mindmap/components/projects/ProjectsSidebar'
import { MindMapCanvas } from '@/products/mind/features/mindmap/components/MindMapCanvas'
import { ProjectProvider } from '@/products/mind/features/mindmap/contexts/ProjectContext'
import {
  UnsavedGuard,
  SaveFlowProvider,
  useSaveFlowContext,
  pendingProjects
} from '@/shared/native'
import { defaultMindmapData } from '@zoeymind/shared'
import { i18next } from '@zoeymind/i18n'

const LOCAL_ORG_ID = 'local'

function ProjectListShell() {
  const [activeView, setActiveView] = useState<ProjectView>('all')
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null)
  const [collapsed, setCollapsed] = useState(false)
  const [searchText, setSearchText] = useState('')

  const handleViewChange = useCallback((next: ProjectView) => {
    setActiveView(next)
    setActiveFolderId(null)
  }, [])

  const handleSelectFolder = useCallback((id: string) => {
    setActiveView('folder')
    setActiveFolderId(id)
  }, [])

  return (
    <div className="relative flex h-full w-full bg-background">
      <ProjectsSidebar
        activeView={activeView}
        activeFolderId={activeFolderId}
        onViewChange={handleViewChange}
        onSelectFolder={handleSelectFolder}
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed(v => !v)}
        activeWorkspaceId={null}
        workspaces={[]}
        onSelectWorkspace={() => undefined}
        onOpenSearch={() => undefined}
        organizationId={LOCAL_ORG_ID}
        canCreateWorkspace={false}
      />
      {collapsed && (
        <button
          onClick={() => setCollapsed(false)}
          className="absolute left-2 top-2 z-20 inline-flex size-8 items-center justify-center rounded-md border bg-background text-muted-foreground shadow-sm hover:bg-muted"
          aria-label="展开侧栏"
        >
          <PanelLeft className="size-4" />
        </button>
      )}
      <div className="flex flex-1 min-w-0 min-h-0">
        <ProjectListPage
          view={activeView}
          folderId={activeFolderId}
          searchText={searchText}
          onClearSearch={() => setSearchText('')}
          workspaceId={null}
          workspaceName={null}
        />
      </div>
    </div>
  )
}

function EditorInner({ id }: { id: string }) {
  const saveFlow = useSaveFlowContext()
  return (
    <ProjectProvider key={id} workspaceId={id} cloudMode={false}>
      <MindMapCanvas />
      <UnsavedGuard projectId={id} saveFlow={saveFlow} />
    </ProjectProvider>
  )
}

/**
 * 已保存项目路由 —— id 是 SqlProjectRepo 里的 uuid.
 * URL 例: /editor/9f2b...
 */
function EditorShell() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  if (!id) {
    navigate('/', { replace: true })
    return null
  }
  return (
    <SaveFlowProvider projectId={id}>
      <EditorInner id={id} />
    </SaveFlowProvider>
  )
}

/**
 * 新建 / draft 路由 —— 每次进来创建一个内存 stash 条目, editor 使用它作为 workspaceId.
 * URL 保持 /editor/new (VS Code 风格), 内部 tempId 仅内存态, refresh 不保留.
 */
function EditorShellForDraft() {
  const navigate = useNavigate()
  // 只在首次挂载时 stash 一份, 避免 React StrictMode 双跑造成两份.
  const draftIdRef = useRef<string | null>(null)
  if (draftIdRef.current === null) {
    const title =
      i18next.t('mindmap.editor.newProjectTitle', '未命名思维导图') || '未命名思维导图'
    draftIdRef.current = pendingProjects.stash({ title, tree: defaultMindmapData })
  }
  const draftId = draftIdRef.current

  // Refresh 后如果 stash 已经不在 (页面 reload), 兜底回列表.
  useEffect(() => {
    if (!pendingProjects.isPending(draftId)) navigate('/', { replace: true })
  }, [draftId, navigate])

  return (
    <SaveFlowProvider projectId={draftId}>
      <EditorInner id={draftId} />
    </SaveFlowProvider>
  )
}

export const router = createBrowserRouter([
  {
    path: '/',
    element: <MainLayout />,
    children: [
      { index: true, element: <ProjectListShell /> },
      { path: 'editor/new', element: <EditorShellForDraft /> },
      { path: 'editor/:id', element: <EditorShell /> },
      { path: '*', element: <Navigate to="/" replace /> }
    ]
  }
])
