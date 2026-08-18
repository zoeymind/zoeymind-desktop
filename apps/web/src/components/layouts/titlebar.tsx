/**
 * 自定义 TitleBar —— macOS Overlay 样式下用于填补拖拽区。
 *
 * 桌面端零个人账号：不显示头像/账号菜单；只放通用主题切换 + 语言切换 +
 * (非 macOS) 系统窗控按钮。
 */
import { useEffect, useState } from 'react'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { Minus, Maximize2, X } from 'lucide-react'
// TitleBar 保持极简: 只有拖拽区 + 系统窗控. 主题/语言按钮放到画布 Header 里.

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
      className="fixed inset-x-0 top-0 z-40 flex h-8 items-center border-b bg-background/80 backdrop-blur"
    >
      {/* macOS: 左边留出原生红绿灯位置；其它平台左对齐产品名 */}
      <div className={isMac ? 'w-20' : 'w-4'} data-tauri-drag-region />
      <div
        className="flex-1 text-center text-xs font-medium text-muted-foreground select-none"
        data-tauri-drag-region
      >
        ZoeyMind
      </div>
      {!isMac && (
        <>
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
        </>
      )}
    </div>
  )
}
