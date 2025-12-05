import { Outlet } from "react-router-dom"
import { TitleBar } from "./titlebar"

export function MainLayout() {
  return (
    <div className="flex h-screen flex-col bg-background">
      <TitleBar />
      {/* 主内容区域，添加 pt-8 为固定标题栏留出空间 */}
      <main className="flex-1 overflow-y-auto pt-8">
        <div className="container mx-auto px-4 py-8">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
