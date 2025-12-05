import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"

export function AboutPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold mb-2">关于 DeskApp</h2>
        <p className="text-muted-foreground text-lg">
          一个现代化的桌面应用开发模板，集成了最佳实践和常用工具。
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="p-6">
          <h3 className="text-xl font-semibold mb-4">核心特性</h3>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <span className="text-primary">•</span>
              <span>跨平台桌面应用支持（Windows, macOS, Linux）</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary">•</span>
              <span>现代化的 React 19 和 TypeScript</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary">•</span>
              <span>美观的 UI 组件库（shadcn/ui）</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary">•</span>
              <span>强大的数据获取和状态管理</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary">•</span>
              <span>完整的类型安全支持</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary">•</span>
              <span>暗色模式支持</span>
            </li>
          </ul>
        </Card>

        <Card className="p-6">
          <h3 className="text-xl font-semibold mb-4">技术栈</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center border-b pb-2">
              <span className="text-sm font-medium">前端框架</span>
              <span className="text-sm text-muted-foreground">React 19 + TypeScript</span>
            </div>
            <div className="flex justify-between items-center border-b pb-2">
              <span className="text-sm font-medium">构建工具</span>
              <span className="text-sm text-muted-foreground">Vite 7</span>
            </div>
            <div className="flex justify-between items-center border-b pb-2">
              <span className="text-sm font-medium">桌面框架</span>
              <span className="text-sm text-muted-foreground">Tauri 2.0</span>
            </div>
            <div className="flex justify-between items-center border-b pb-2">
              <span className="text-sm font-medium">UI 组件</span>
              <span className="text-sm text-muted-foreground">shadcn/ui</span>
            </div>
            <div className="flex justify-between items-center border-b pb-2">
              <span className="text-sm font-medium">数据获取</span>
              <span className="text-sm text-muted-foreground">TanStack Query</span>
            </div>
            <div className="flex justify-between items-center border-b pb-2">
              <span className="text-sm font-medium">状态管理</span>
              <span className="text-sm text-muted-foreground">Zustand</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">路由</span>
              <span className="text-sm text-muted-foreground">React Router v7</span>
            </div>
          </div>
        </Card>

        <Card className="p-6 md:col-span-2">
          <h3 className="text-xl font-semibold mb-4">快速开始</h3>
          <div className="space-y-3">
            <div className="rounded-md bg-muted p-4 font-mono text-sm">
              <div className="text-muted-foreground"># 安装依赖</div>
              <div className="mt-1">pnpm install</div>
            </div>
            <div className="rounded-md bg-muted p-4 font-mono text-sm">
              <div className="text-muted-foreground"># 启动开发服务器</div>
              <div className="mt-1">pnpm tauri:dev</div>
            </div>
            <div className="rounded-md bg-muted p-4 font-mono text-sm">
              <div className="text-muted-foreground"># 构建应用</div>
              <div className="mt-1">pnpm tauri:build</div>
            </div>
          </div>
          <div className="mt-4">
            <Button
              onClick={() => {
                toast.success("感谢使用 DeskApp！", {
                  description: "开始构建你的桌面应用吧",
                })
              }}
            >
              开始使用
            </Button>
          </div>
        </Card>
      </div>
    </div>
  )
}
