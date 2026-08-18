import { useEffect, useState } from "react"
import { Link, useLocation } from "react-router-dom"
import { getCurrentWindow } from "@tauri-apps/api/window"
import { Minus, Maximize2, X, Settings, Moon, Sun } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { getPlatform } from "@/lib/platform"
import { useAppStore } from "@/stores/use-app-store"

const appWindow = getCurrentWindow()

export function TitleBar() {
  const location = useLocation()
  const [platform, setPlatform] = useState<"macos" | "windows" | "linux">("macos")
  const { theme, setTheme } = useAppStore()

  useEffect(() => {
    getPlatform().then(setPlatform)
  }, [])

  useEffect(() => {
    const root = document.documentElement
    if (theme === "dark") {
      root.classList.add("dark")
    } else {
      root.classList.remove("dark")
    }
  }, [theme])

  const handleMinimize = () => {
    appWindow.minimize()
  }

  const handleMaximize = () => {
    appWindow.toggleMaximize()
  }

  const handleClose = () => {
    appWindow.close()
  }

  const isMacOS = platform === "macos"
  const isWindows = platform === "windows"

  return (
    <div
      data-tauri-drag-region
      className="fixed top-0 left-0 right-0 z-50 flex h-8 select-none items-center justify-between border-b bg-background/95 backdrop-blur-md"
    >
      {/* 左侧：macOS 原生按钮区域 */}
      {isMacOS && <div data-tauri-drag-region className="w-[70px]" />}

      {/* 中间：导航链接 */}
      <div data-tauri-drag-region className="flex flex-1 items-center pl-4">
        <nav className="flex gap-4">
          <Link
            to="/"
            className={cn(
              "text-sm font-medium transition-colors hover:text-foreground/80",
              location.pathname === "/" ? "text-foreground" : "text-muted-foreground"
            )}
          >
            首页
          </Link>
          <Link
            to="/todos"
            className={cn(
              "text-sm font-medium transition-colors hover:text-foreground/80",
              location.pathname === "/todos" ? "text-foreground" : "text-muted-foreground"
            )}
          >
            Todos
          </Link>
          <Link
            to="/about"
            className={cn(
              "text-sm font-medium transition-colors hover:text-foreground/80",
              location.pathname === "/about" ? "text-foreground" : "text-muted-foreground"
            )}
          >
            关于
          </Link>
        </nav>
      </div>

      {/* 右侧：操作按钮和 Windows 窗口控制按钮 */}
      <div data-tauri-drag-region className="flex items-center gap-1.5 pr-2">
        <Button
          variant="ghost"
          size="icon-sm"
          className="h-5 w-5 rounded-sm"
          onClick={() => setTheme(theme === "light" ? "dark" : "light")}
        >
          {theme === "light" ? <Moon className="h-3.5 w-3.5" /> : <Sun className="h-3.5 w-3.5" />}
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          className="h-5 w-5 rounded-sm"
          onClick={() => toast.info("未开发")}
        >
          <Settings className="h-3.5 w-3.5" />
        </Button>
        {isWindows && (
          <>
            <Button
              variant="ghost"
              size="icon-sm"
              className="h-5 w-5 rounded-sm"
              onClick={handleMinimize}
            >
              <Minus className="h-2.5 w-2.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              className="h-5 w-5 rounded-sm"
              onClick={handleMaximize}
            >
              <Maximize2 className="h-2.5 w-2.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              className="h-5 w-5 rounded-sm hover:bg-destructive hover:text-destructive-foreground"
              onClick={handleClose}
            >
              <X className="h-2.5 w-2.5" />
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
