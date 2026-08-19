/**
 * 监听 OS 层双击 .zmind (or 命令行 argv) 打开文件的请求.
 *
 *   - macOS: Tauri RunEvent::Opened
 *   - Windows/Linux: 进程 argv
 * Rust 侧在前端 listener 就绪前缓存路径，之后由 `take_pending_open_files` 一次取走；
 * listener 就绪后的请求通过 `zm:open-file` 实时事件交付。
 *
 * 前端统一走 openTab 流程；已打开的 Tab 会被 openTab 去重并激活。
 */
import { useEffect } from "react"
import { invoke } from "@tauri-apps/api/core"
import { listen, type UnlistenFn } from "@tauri-apps/api/event"
import { logger } from "@zoeymind/logger"
import { bumpProjects, createUUID, findByPath, registerProject } from "@/shared/native"
import { useTabs } from "@/shared/tabs/store"

const openingPaths = new Map<string, Promise<void>>()

async function openZmindPath(path: string): Promise<void> {
  try {
    const existing = await findByPath(path)
    let id = existing?.id
    // 名字权威源: 文件名 (foo.zmind -> foo).
    const name =
      path
        .split(/[\\/]/)
        .pop()!
        .replace(/\.zmind$/i, "") || "Untitled"
    if (!id) {
      id = createUUID()
      await registerProject({ id, path, name, nodeCount: 0 })
      bumpProjects()
    }
    useTabs.getState().openTab({ id, kind: "file", title: name, projectId: id })
  } catch (error) {
    logger.error("外部 .zmind 打开失败", error)
  }
}

async function openZmindPaths(paths: unknown): Promise<void> {
  if (!Array.isArray(paths)) return
  const opens = paths.flatMap(path => {
    if (typeof path !== "string" || !/\.zmind$/i.test(path)) return []
    const existing = openingPaths.get(path)
    if (existing) return [existing]
    const opening = openZmindPath(path).finally(() => openingPaths.delete(path))
    openingPaths.set(path, opening)
    return [opening]
  })
  await Promise.all(opens)
}

/**
 * 挂到 App 顶层。先建立实时订阅，再取走 Rust 中的冷启动队列，避免首次启动
 * argv / macOS Opened 事件发生在 React listener 挂载前而丢失。
 */
export function FileAssociationsListener({
  onInitialFilesOpened,
}: {
  onInitialFilesOpened: () => void
}): null {
  useEffect(() => {
    let disposed = false
    let unlisten: UnlistenFn | undefined
    void listen<string[]>("zm:open-file", event => {
      void openZmindPaths(event.payload)
    }).then(async stop => {
      if (disposed) {
        stop()
        return
      }
      unlisten = stop
      try {
        await openZmindPaths(await invoke<string[]>("take_pending_open_files"))
      } catch (error) {
        logger.error("读取启动文件参数失败", error)
      } finally {
        if (!disposed) onInitialFilesOpened()
      }
    })
    return () => {
      disposed = true
      unlisten?.()
    }
  }, [onInitialFilesOpened])
  return null
}
