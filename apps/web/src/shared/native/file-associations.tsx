/**
 * 监听 OS 层双击 .zmind (or 命令行 argv) 打开文件的请求.
 *
 * 触发来源:
 *   - macOS: fileAssociations + open event 转发到 tauri-plugin-single-instance
 *     的 argv 参数
 *   - Windows/Linux: 用户点 .zmind, 系统调用我们 exe + 文件路径 argv
 * Rust 侧 (lib.rs) 收到 argv 后 emit `zm:open-file` (Vec<String>).
 *
 * 前端: 收到事件后走 openTab 流程. 已开的 tab 自动被 openTab 去重命中激活.
 */
import { useEffect } from 'react'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { logger } from '@zoeymind/logger'
import {
  bumpProjects,
  createUUID,
  findByPath,
  registerProject
} from '@/shared/native'
import { useTabs } from '@/shared/tabs/store'

async function openZmindPath(path: string): Promise<void> {
  try {
    const existing = await findByPath(path)
    let id = existing?.id
    // 名字权威源: 文件名 (foo.zmind -> foo).
    const name = path.split(/[\\/]/).pop()!.replace(/\.zmind$/i, '') || 'Untitled'
    if (!id) {
      id = createUUID()
      await registerProject({ id, path, name, nodeCount: 0 })
      bumpProjects()
    }
    useTabs.getState().openTab({ id, kind: 'file', title: name, projectId: id })
    // 前台化窗口 (SingleInstance 侧已 focus, 这里保险再来一次)
    void getCurrentWindow()
      .setFocus()
      .catch(() => undefined)
  } catch (error) {
    logger.error('外部 .zmind 打开失败', error)
  }
}

/**
 * 挂到 App 顶层. 挂载时:
 *   1. 订阅 `zm:open-file` 事件, payload = string[] 的路径
 *   2. TODO: 首次启动检查 argv (通过 `getCurrentWebviewWindow().url` or tauri API)
 */
export function FileAssociationsListener(): null {
  useEffect(() => {
    let unlisten: UnlistenFn | undefined
    void listen<string[]>('zm:open-file', event => {
      const paths = event.payload
      if (!Array.isArray(paths)) return
      paths.forEach(p => {
        if (typeof p === 'string' && p.endsWith('.zmind')) {
          void openZmindPath(p)
        }
      })
    }).then(fn => {
      unlisten = fn
    })
    return () => {
      unlisten?.()
    }
  }, [])
  return null
}
