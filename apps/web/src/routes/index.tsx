import { createBrowserRouter, Navigate } from 'react-router-dom'
import { MainLayout } from '@/components/layouts/main-layout'
import { ProjectListPage } from '@/pages/ProjectListPage'
import { MindMapEditorPage } from '@/pages/MindMapEditorPage'
import { SettingsPage } from '@/pages/SettingsPage'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <MainLayout />,
    children: [
      { index: true, element: <ProjectListPage /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: '*', element: <Navigate to="/" replace /> }
    ]
  },
  {
    // 编辑器脱嵌路由：全屏无 MainLayout 侧边导航
    path: '/editor/:id',
    element: <MindMapEditorPage />
  }
])
