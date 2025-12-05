import { Button } from "@/components/ui/button"
import { useAppStore } from "@/stores/use-app-store"
import { useExample } from "@/hooks/queries/use-example"
import { toast } from "sonner"

export function HomePage() {
  const { theme } = useAppStore()
  const { data, isLoading } = useExample()

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold mb-2">欢迎使用 DeskApp</h2>
        <p className="text-muted-foreground text-lg">
          这是一个使用 Tauri 2.0 + React + shadcn/ui 构建的现代化桌面应用模板。
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-4 rounded-lg border p-6">
          <h3 className="text-xl font-semibold">功能演示</h3>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => {
                toast.success("操作成功！", {
                  description: "这是一个成功提示示例",
                })
              }}
            >
              成功提示
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                toast.error("操作失败", {
                  description: "这是一个错误提示示例",
                })
              }}
            >
              错误提示
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                toast.info("信息提示", {
                  description: "这是一个信息提示示例",
                })
              }}
            >
              信息提示
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                toast.warning("警告提示", {
                  description: "这是一个警告提示示例",
                })
              }}
            >
              警告提示
            </Button>
          </div>
        </div>

        <div className="space-y-4 rounded-lg border p-6">
          <h3 className="text-xl font-semibold">TanStack Query 示例</h3>
          {isLoading ? (
            <div className="space-y-2">
              <div className="h-4 w-full animate-pulse rounded bg-muted" />
              <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
            </div>
          ) : (
            <ul className="space-y-2">
              {data?.map(item => (
                <li key={item.id} className="flex items-center gap-2 rounded-md border p-2">
                  <span className="text-sm font-medium">{item.name}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="space-y-4 rounded-lg border p-6">
          <h3 className="text-xl font-semibold">当前状态</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">主题模式：</span>
              <span className="font-medium">{theme === "light" ? "亮色" : "暗色"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">数据加载：</span>
              <span className="font-medium">{isLoading ? "加载中..." : "已完成"}</span>
            </div>
          </div>
        </div>

        <div className="space-y-4 rounded-lg border p-6">
          <h3 className="text-xl font-semibold">技术栈</h3>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="rounded-md bg-muted p-2 text-center">React 19</div>
            <div className="rounded-md bg-muted p-2 text-center">TypeScript</div>
            <div className="rounded-md bg-muted p-2 text-center">Vite 7</div>
            <div className="rounded-md bg-muted p-2 text-center">Tauri 2.0</div>
            <div className="rounded-md bg-muted p-2 text-center">shadcn/ui</div>
            <div className="rounded-md bg-muted p-2 text-center">TanStack Query</div>
            <div className="rounded-md bg-muted p-2 text-center">Zustand</div>
            <div className="rounded-md bg-muted p-2 text-center">React Router</div>
          </div>
        </div>
      </div>
    </div>
  )
}
