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

/**
 * 列表页壳 —— 参照产品仓的 zoeymind/projects.tsx：左侧 ProjectsSidebar，
 * 右侧 ProjectListPage。桌面端零工作区/组织概念，workspaceId 用固定 'local'。
 */
function ProjectListShell() {
  const [view, setView] = useState<ProjectView>('all')
  const [folderId, setFolderId] = useState<string | null>(null)
  const [searchText, setSearchText] = useState('')

  const handleViewChange = useCallback((next: ProjectView) => {
    setView(next)
    setFolderId(null)
  }, [])

  const handleSelectFolder = useCallback((id: string) => {
    setView('folder')
    setFolderId(id)
  }, [])

  return (
    <div className="flex h-screen w-full bg-background">
      <ProjectsSidebar
        view={view}
        onViewChange={handleViewChange}
        activeFolderId={folderId}
        onSelectFolder={handleSelectFolder}
        workspaces={[]}
        workspacesLoading={false}
        activeWorkspaceId={null}
        onSelectWorkspace={() => undefined}
        canCreateWorkspace={false}
        onCreateWorkspace={() => undefined}
      />
      <div className="flex-1 min-w-0">
        <ProjectListPage
          view={view}
          folderId={folderId}
          searchText={searchText}
          onClearSearch={() => setSearchText('')}
          workspaceId={null}
          workspaceName={null}
        />
      </div>
    </div>
  )
}

/**
 * 编辑器壳 —— URL: /editor/:id → ProjectProvider(workspaceId=id, cloudMode=false)
 * + 原 MindMapCanvas，样式完全跟产品仓一致。
 */
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
    // 编辑器脱嵌路由：全屏无 MainLayout
    path: '/editor/:id',
    element: <EditorShell />
  }
])
