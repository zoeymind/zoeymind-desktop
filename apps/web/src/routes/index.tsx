import { createBrowserRouter, Navigate, useNavigate, useParams } from 'react-router-dom'
import { useCallback, useState } from 'react'
import { PanelLeft } from 'lucide-react'
import { MainLayout } from '@/components/layouts/main-layout'
import { ProjectListPage } from '@/products/mind/features/mindmap/pages/ProjectsPage'
import {
  ProjectsSidebar,
  type ProjectView
} from '@/products/mind/features/mindmap/components/projects/ProjectsSidebar'
import { MindMapCanvas } from '@/products/mind/features/mindmap/components/MindMapCanvas'
import { SettingsPage } from '@/pages/SettingsPage'
import { ProjectProvider } from '@/products/mind/features/mindmap/contexts/ProjectContext'
import { UnsavedGuard, useSaveFlow } from '@/shared/native'

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
      {/* 侧栏收起时的展开按钮 —— 悬浮在主区左上角 */}
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

function EditorShell() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const saveFlow = useSaveFlow(id ?? null)
  if (!id) {
    navigate('/', { replace: true })
    return null
  }
  return (
    <ProjectProvider key={id} workspaceId={id} cloudMode={false}>
      <MindMapCanvas />
      <UnsavedGuard projectId={id} saveFlow={saveFlow} />
    </ProjectProvider>
  )
}

export const router = createBrowserRouter([
  {
    path: '/',
    element: <MainLayout />,
    children: [
      { index: true, element: <ProjectListShell /> },
      { path: 'editor/:id', element: <EditorShell /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: '*', element: <Navigate to="/" replace /> }
    ]
  }
])
