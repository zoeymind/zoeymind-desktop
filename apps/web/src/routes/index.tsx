import { createBrowserRouter, Navigate, useNavigate, useParams } from 'react-router-dom'
import { useCallback, useState } from 'react'
import { MainLayout } from '@/components/layouts/main-layout'
import { ProjectListPage } from '@/products/mind/features/mindmap/pages/ProjectsPage'
import {
  ProjectsSidebar,
  type ProjectView
} from '@/products/mind/features/mindmap/components/projects/ProjectsSidebar'
import { MindMapCanvas } from '@/products/mind/features/mindmap/components/MindMapCanvas'
import { ProjectProvider } from '@/products/mind/features/mindmap/contexts/ProjectContext'

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
    <div className="flex h-screen w-full bg-background">
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
      <div className="flex-1 min-w-0">
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
  if (!id) {
    navigate('/', { replace: true })
    return null
  }
  return (
    <ProjectProvider key={id} workspaceId={id} cloudMode={false}>
      <MindMapCanvas />
    </ProjectProvider>
  )
}

export const router = createBrowserRouter([
  {
    path: '/',
    element: <MainLayout />,
    children: [
      { index: true, element: <ProjectListShell /> },
      { path: '*', element: <Navigate to="/" replace /> }
    ]
  },
  {
    path: '/editor/:id',
    element: <EditorShell />
  }
])
