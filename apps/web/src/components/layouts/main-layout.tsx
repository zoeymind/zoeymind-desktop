import { Outlet } from 'react-router-dom'
import { TitleBar } from './titlebar'

/**
 * 顶层布局：
 *   - 固定顶部 32px TitleBar（Tauri Overlay 样式；含拖拽 + 系统按钮）
 *   - 主内容 flex-1 占满剩余，edge-to-edge
 *
 * TitleBar 用 `fixed inset-x-0 top-0 h-8`，所以主内容用 `pt-8` 让开高度。
 */
export function MainLayout() {
  return (
    <div className="flex h-screen flex-col bg-background">
      <TitleBar />
      <main className="flex-1 min-h-0 overflow-hidden pt-8">
        <Outlet />
      </main>
    </div>
  )
}
