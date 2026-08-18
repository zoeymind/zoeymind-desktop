/**
 * 路由 = URL 适配层, tabs store 是 SOURCE OF TRUTH.
 *
 * 顶层只有一个 route "/*", 由 <WorkspaceShell> 根据 useTabs().activeId 决定
 * 展示 Home 还是某个编辑器 tab.
 *
 * URL <-> tabs 双向:
 *   - 用户点 tab / 关闭 tab / 首次打开时: activeId 变化 -> useEffect
 *     replaceState(url) 让浏览器 URL 反映当前 tab (deep-link 分享).
 *   - 外部 URL (/editor/:id / /editor/new) 到达: WorkspaceShell 在 mount 时把 URL
 *     解释成 openTab + setActive, 之后 URL 由 store 主导.
 */
import { useEffect, useRef } from 'react'
import {
  createBrowserRouter,
  Navigate,
  useLocation,
  useNavigate
} from 'react-router-dom'
import { MainLayout } from '@/components/layouts/main-layout'
import { WorkspaceShell } from '@/components/workspace-shell'

function RouteAdapter() {
  const location = useLocation()
  const navigate = useNavigate()
  const bootstrappedRef = useRef(false)

  // 只在首次挂载时把 URL 解释为 tab (deep-link).
  useEffect(() => {
    if (bootstrappedRef.current) return
    bootstrappedRef.current = true
    void (async () => {
      const path = location.pathname
      const { useTabs } = await import('@/shared/tabs/store')
      const { pendingProjects } = await import('@/shared/native')
      const { defaultMindmapData } = await import('@zoeymind/shared')
      const { i18next } = await import('@zoeymind/i18n')
      const s = useTabs.getState()
      if (path === '/editor/new') {
        const title = i18next.t('mindmap.editor.newProjectTitle', '未命名思维导图')
        const draftId = pendingProjects.stash({ title, tree: defaultMindmapData })
        s.openTab({ id: draftId, kind: 'draft', title })
      } else if (path.startsWith('/editor/')) {
        const id = path.slice('/editor/'.length)
        if (id) {
          const { getProject } = await import('@/shared/native')
          const row = await getProject(id)
          s.openTab({ id, kind: 'file', title: row?.name ?? id })
        }
      } else {
        s.setActive('home')
      }
      // URL 冗余部分统一收敛回 store 决定的形式.
      navigate('/', { replace: true })
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return <WorkspaceShell />
}

export const router = createBrowserRouter([
  {
    path: '/',
    element: <MainLayout />,
    children: [
      { index: true, element: <RouteAdapter /> },
      { path: 'editor/new', element: <RouteAdapter /> },
      { path: 'editor/:id', element: <RouteAdapter /> },
      { path: '*', element: <Navigate to="/" replace /> }
    ]
  }
])
