/**
 * TitleBar —— 40px 高, 浏览器风格.
 *
 * 布局:
 *   [macOS 红绿灯 spacer, h-full drag] [TabBar h-full] [drag spacer flex-1 h-full] [系统按钮 (非 mac)]
 *
 * 所有子元素 h-full items-center, 让 tab / 图标视觉上填满整个 titlebar 高度.
 * macOS 红绿灯位置由 tauri.conf.json trafficLightPosition {x:12, y:13} 精调.
 */
import { useEffect, useState, type PointerEvent as ReactPointerEvent } from "react"
import { getCurrentWindow } from "@tauri-apps/api/window"
import { Copy, Minus, Settings, Square, X } from "lucide-react"
import { useTranslation } from "@zoeymind/i18n"
import { Button } from "@zoeymind/ui"
import { SettingsDialog } from "@/pages/SettingsDialog"
import { TabBar } from "./tab-bar"
import { isPhysicalTitlebarTarget } from "./titlebar-drag"

const appWindow = getCurrentWindow()

const PREVIEW_CUSTOM_WINDOW_CONTROLS = false

async function detectPlatform(): Promise<"macos" | "windows" | "linux"> {
  const ua = navigator.userAgent.toLowerCase()
  if (ua.includes("mac")) return "macos"
  if (ua.includes("win")) return "windows"
  return "linux"
}

export function TitleBar() {
  const [platform, setPlatform] = useState<"macos" | "windows" | "linux">("macos")
  const { t } = useTranslation()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [maximized, setMaximized] = useState(false)
  useEffect(() => {
    void detectPlatform().then(setPlatform)
  }, [])
  useEffect(() => {
    const updateMaximized = () => void appWindow.isMaximized().then(setMaximized)
    updateMaximized()
    let unlisten: (() => void) | undefined
    void appWindow.onResized(updateMaximized).then(stop => {
      unlisten = stop
    })
    return () => unlisten?.()
  }, [])
  const isMac = platform === "macos"

  const handleTitlebarPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!isPhysicalTitlebarTarget(event.currentTarget, event.target as Node)) return
    if (event.button !== 0) return
    const target = event.target as HTMLElement
    if (target.closest("button, [role='tab'], [data-tab-interactive]")) return
    if (event.detail === 2) void appWindow.toggleMaximize()
    else void appWindow.startDragging()
  }

  return (
    <div
      onPointerDown={handleTitlebarPointerDown}
      data-app-titlebar
      className="fixed inset-x-0 top-0 z-[100] flex h-10 items-stretch bg-muted/60 backdrop-blur"
    >
      {/* TabBar 作为全宽底层，液态渐变延展到窗口最右边；右侧控制按钮浮在其上。 */}
      <div className="absolute inset-0 min-w-0">
        <TabBar isMac={isMac} />
      </div>
      <div data-tab-interactive className="relative z-40 ml-auto flex h-full items-center">
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10 rounded-none active:scale-[0.96]"
          onClick={() => setSettingsOpen(true)}
          aria-label={t("settings.title")}
          title={t("settings.title")}
        >
          <Settings className="size-4" />
        </Button>

        {(PREVIEW_CUSTOM_WINDOW_CONTROLS || !isMac) && (
          <div className="flex h-full items-center" aria-label={t("windowControls.groupLabel")}>
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-11 rounded-none active:scale-[0.96]"
              onClick={() => void appWindow.minimize()}
              aria-label={t("windowControls.minimize")}
              title={t("windowControls.minimize")}
            >
              <Minus className="size-4 stroke-[1.5]" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-11 rounded-none active:scale-[0.96]"
              onClick={() => void appWindow.toggleMaximize()}
              aria-label={t(maximized ? "windowControls.restore" : "windowControls.maximize")}
              title={t(maximized ? "windowControls.restore" : "windowControls.maximize")}
            >
              {maximized ? (
                <Copy className="size-3.5 stroke-[1.5]" />
              ) : (
                <Square className="size-3 stroke-[1.5]" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-11 rounded-none hover:bg-destructive hover:text-destructive-foreground active:scale-[0.96]"
              onClick={() => void appWindow.close()}
              aria-label={t("windowControls.close")}
              title={t("windowControls.close")}
            >
              <X className="size-4 stroke-[1.5]" />
            </Button>
          </div>
        )}
      </div>
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  )
}
