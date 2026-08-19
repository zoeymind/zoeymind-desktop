/**
 * TitleBar —— 40px 高, 浏览器风格.
 *
 * 布局:
 *   [macOS 红绿灯 spacer, h-full drag] [TabBar h-full] [drag spacer flex-1 h-full] [系统按钮 (非 mac)]
 *
 * 所有子元素 h-full items-center, 让 tab / 图标视觉上填满整个 titlebar 高度.
 * macOS 红绿灯位置由 tauri.conf.json trafficLightPosition {x:12, y:13} 精调.
 */
import { useEffect, useState } from "react"
import { getCurrentWindow } from "@tauri-apps/api/window"
import { Minus, Maximize2, X } from "lucide-react"
import { TabBar } from "./tab-bar"

const appWindow = getCurrentWindow()

async function detectPlatform(): Promise<"macos" | "windows" | "linux"> {
  const ua = navigator.userAgent.toLowerCase()
  if (ua.includes("mac")) return "macos"
  if (ua.includes("win")) return "windows"
  return "linux"
}

export function TitleBar() {
  const [platform, setPlatform] = useState<"macos" | "windows" | "linux">("macos")
  useEffect(() => {
    void detectPlatform().then(setPlatform)
  }, [])
  const isMac = platform === "macos"

  return (
    <div
      data-tauri-drag-region
      className="fixed inset-x-0 top-0 z-[100] flex h-10 items-stretch bg-muted/60 backdrop-blur"
    >
      {/* macOS 红绿灯占位由 TabBar 内部 startInset=88 让开; 液态 panel 仍从 x=0 铺满. */}
      <div data-tauri-drag-region className="flex h-full min-w-0 flex-1 items-stretch">
        <TabBar isMac={isMac} />
      </div>

      {!isMac && (
        <div className="flex h-full items-center">
          <button
            onClick={() => appWindow.minimize()}
            className="flex h-8 items-center px-3 hover:bg-muted"
          >
            <Minus className="size-3.5" />
          </button>
          <button
            onClick={() => appWindow.toggleMaximize()}
            className="flex h-8 items-center px-3 hover:bg-muted"
          >
            <Maximize2 className="size-3.5" />
          </button>
          <button
            onClick={() => appWindow.close()}
            className="flex h-8 items-center px-3 hover:bg-destructive hover:text-destructive-foreground"
          >
            <X className="size-3.5" />
          </button>
        </div>
      )}
    </div>
  )
}
