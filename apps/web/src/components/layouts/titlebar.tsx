/**
 * TitleBar —— 40px 高, 浏览器风格.
 *
 * 布局:
 *   [macOS 红绿灯 spacer, h-full drag] [TabBar h-full] [drag spacer flex-1 h-full] [系统按钮 (非 mac)]
 *
 * 所有子元素 h-full items-center, 让 tab / 图标视觉上填满整个 titlebar 高度.
 * macOS 红绿灯位置由 tauri.conf.json trafficLightPosition {x:12, y:13} 精调.
 */
import { useEffect, useState } from 'react'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { Minus, Maximize2, X } from 'lucide-react'
import { TabBar } from './tab-bar'

const appWindow = getCurrentWindow()

async function detectPlatform(): Promise<'macos' | 'windows' | 'linux'> {
  const ua = navigator.userAgent.toLowerCase()
  if (ua.includes('mac')) return 'macos'
  if (ua.includes('win')) return 'windows'
  return 'linux'
}

export function TitleBar() {
  const [platform, setPlatform] = useState<'macos' | 'windows' | 'linux'>('macos')
  useEffect(() => {
    void detectPlatform().then(setPlatform)
  }, [])
  const isMac = platform === 'macos'

  return (
    <div
      data-tauri-drag-region
      className="fixed inset-x-0 top-0 z-[100] flex h-10 items-center border-b bg-muted/60 backdrop-blur"
    >
      {/* macOS spacer: 让开系统红绿灯 (由 trafficLightPosition 精调居中) */}
      <div className={isMac ? 'h-full w-[72px] shrink-0' : 'h-full w-2 shrink-0'} data-tauri-drag-region />

      {/* 品牌名 —— Home 图标左侧 */}
      <div
        data-tauri-drag-region
        className="flex h-full items-center pl-2 pr-1 text-xs font-semibold tracking-tight text-foreground select-none"
      >
        ZoeyMind
      </div>
      <div
        data-tauri-drag-region
        className="flex h-full min-w-0 max-w-[70%] flex-1 items-center"
      >
        <TabBar />
      </div>

      {/* 剩余可拖窗空白 */}
      <div className="flex h-full min-w-8 flex-1" data-tauri-drag-region />

      {!isMac && (
        <div className="flex h-full items-center">
          <button
            onClick={() => appWindow.minimize()}
            className="flex h-full items-center px-3 hover:bg-muted"
          >
            <Minus className="size-3.5" />
          </button>
          <button
            onClick={() => appWindow.toggleMaximize()}
            className="flex h-full items-center px-3 hover:bg-muted"
          >
            <Maximize2 className="size-3.5" />
          </button>
          <button
            onClick={() => appWindow.close()}
            className="flex h-full items-center px-3 hover:bg-destructive hover:text-destructive-foreground"
          >
            <X className="size-3.5" />
          </button>
        </div>
      )}
    </div>
  )
}
