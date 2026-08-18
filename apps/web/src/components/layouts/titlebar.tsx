/**
 * TitleBar —— 40px 高, 浏览器风格:
 *   [macOS 红绿灯 spacer] [TabBar (flex-1, 内部横向滚动)] [drag spacer] [系统按钮]
 *
 * 拖拽区仅在 tabs 之后剩下的空白区域, 保证 tab 数量少 / 空闲区域时都能拖窗.
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
      className="fixed inset-x-0 top-0 z-40 flex h-10 items-end border-b bg-muted/40 backdrop-blur"
    >
      {/* 平台 spacer: macOS 让开红绿灯 */}
      <div className={isMac ? 'w-20 shrink-0' : 'w-2 shrink-0'} data-tauri-drag-region />

      {/* Tabs 区: 最多占 70%, 内部横向滚动. min-w-0 让 flex 允许收缩 */}
      <div className="flex h-full min-w-0 max-w-[70%] flex-1 items-end">
        <TabBar />
      </div>

      {/* 剩余 drag 空间: flex-1, 保证有一大段能拖窗口 */}
      <div className="flex h-full min-w-8 flex-1" data-tauri-drag-region />

      {!isMac && (
        <div className="flex h-full items-center">
          <button onClick={() => appWindow.minimize()} className="p-1.5 hover:bg-muted">
            <Minus className="size-3.5" />
          </button>
          <button onClick={() => appWindow.toggleMaximize()} className="p-1.5 hover:bg-muted">
            <Maximize2 className="size-3.5" />
          </button>
          <button
            onClick={() => appWindow.close()}
            className="p-1.5 hover:bg-destructive hover:text-destructive-foreground"
          >
            <X className="size-3.5" />
          </button>
        </div>
      )}
    </div>
  )
}
