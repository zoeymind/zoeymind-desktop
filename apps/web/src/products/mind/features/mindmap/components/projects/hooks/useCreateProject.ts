/**
 * useCreateProject —— 桌面端本地版:
 *   - 新建/导入 = pendingProjects.stash + useTabs.openTab (draft)
 *   - 保存由 saveFlow.save() 走 native saveDialog
 *   - 关闭 draft tab 无保存 -> 不留记录
 */
import { useCallback, useState } from "react"
import { logger } from "@zoeymind/logger"
import { toast } from "@/shared/app-shared"
import { i18next } from "@zoeymind/i18n"
import type { MindMapNodeTree } from "simple-mind-map"
import { defaultMindmapData } from "@zoeymind/shared"

import { parseMindMapImport } from "@/products/mind/features/mindmap/utils/importMindMapFile"
import { pendingProjects } from "@/shared/native"
import { useTabs } from "@/shared/tabs/store"

export type ImportFormat = "xmind-standard" | "xmind-zm" | "markdown"

interface UseCreateProjectOptions {
  folderId?: string | null
  onCreated?: (id: string) => void
}

interface UseCreateProjectReturn {
  creating: boolean
  createBlank: () => Promise<void>
  createFromImport: (file: File, xmindFormat?: "standard" | "zm") => Promise<void>
}

function deriveTitleFromFilename(filename: string): string {
  const base = filename.replace(/\.[^./\\]+$/, "")
  return base.trim() || i18next.t("mindmap.editor.newProjectTitle", "未命名思维导图")
}

function stashAndOpenTab(title: string, tree: MindMapNodeTree, onCreated?: (id: string) => void) {
  const id = pendingProjects.stash({ title, tree })
  useTabs.getState().openTab({ id, kind: "draft", title })
  onCreated?.(id)
}

export function useCreateProject(opts: UseCreateProjectOptions = {}): UseCreateProjectReturn {
  const [creating, setCreating] = useState(false)

  const createBlank = useCallback(async () => {
    if (creating) return
    setCreating(true)
    try {
      const title = i18next.t("mindmap.editor.newProjectTitle", "未命名思维导图")
      stashAndOpenTab(title, defaultMindmapData, opts.onCreated)
    } catch (error) {
      logger.error("新建 draft tab 失败", error)
      toast.error(i18next.t("mindmap.editor.createFailed"))
    } finally {
      setCreating(false)
    }
  }, [creating, opts.onCreated])

  const createFromImport = useCallback(
    async (file: File, xmindFormat: "standard" | "zm" = "standard") => {
      if (creating) return
      setCreating(true)
      try {
        const parsed = await parseMindMapImport(file, xmindFormat)
        stashAndOpenTab(deriveTitleFromFilename(file.name), parsed, opts.onCreated)
      } catch (error) {
        logger.error("导入失败", error)
        toast.error(i18next.t("mindmap.editor.importFailed"))
      } finally {
        setCreating(false)
      }
    },
    [creating, opts.onCreated]
  )

  return { creating, createBlank, createFromImport }
}

// 旧 sessionStorage handoff 常量, 桌面端不用, 保留占位.
export const PENDING_IMPORT_STORAGE_PREFIX = "mindmap:pending-import:"

export default useCreateProject
