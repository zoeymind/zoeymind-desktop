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
import { createBrowserRouter } from "react-router-dom"
import { MainLayout } from "@/components/layouts/main-layout"
import { RouteErrorFallback } from "./route-error-fallback"
import { RouteAdapter } from "./route-adapter"

export const router = createBrowserRouter([
  {
    path: "/",
    element: <MainLayout />,
    errorElement: <RouteErrorFallback />,
    children: [
      { index: true, element: <RouteAdapter /> },
      { path: "editor/new", element: <RouteAdapter /> },
      { path: "editor/:id", element: <RouteAdapter /> },
      { path: "*", element: <RouteAdapter /> },
    ],
  },
])
