// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- legacy hook API retains product type gaps during desktop migration
// @ts-nocheck
/**
 * useCloudProjects —— 桌面端本地版：由 SqlProjectRepo 驱动，让 CloudProjectList 直接渲染本地导图列表。
 * 保留原产品版本的 API 表面（projects / loading / renameProject / deleteProject / toggleFavorite ...），
 * 组件级 JSX 完全不改。
 */
import { useCallback, useEffect, useMemo, useState } from "react"
import { logger } from "@zoeymind/logger"
import { i18next } from "@zoeymind/i18n"
import { toast } from "@/shared/app-shared"
import { defaultMindmapData } from "@zoeymind/shared"
import { useTabs } from "@/shared/tabs/store"
import { projectSessionRegistry } from "@/products/mind/editor-session"
import {
  listProjects,
  pendingProjects,
  notifyProjectRenamed,
  renameProjectFile,
  setStarred,
  useProjectsEvents,
  unregisterProject,
  type ProjectRow,
} from "@/shared/native"

export interface CloudProjectWithStats {
  id: string
  name: string
  path: string
  updatedAt: string
  createdAt: string
  workspaceId: null
  folderId: string | null
  isFavorited: boolean
  isOwner: true
  isArchived: boolean
  exists: boolean
  metadata: { starred: boolean; tags: string[] }
  stats: { nodeCount: number; size: number }
  nodeCount: number
  size: number
}

/** '/a/b/foo.zmind' -> 'foo' | '' -> 'Untitled' */
function fileBasenameNoExt(p: string): string {
  if (!p) return "Untitled"
  const last = p.split(/[\\/]/).pop() ?? ""
  return last.replace(/\.zmind$/i, "") || "Untitled"
}

function toCloud(row: ProjectRow): CloudProjectWithStats {
  return {
    id: row.id,
    // 名字权威源: 文件名 (foo.zmind -> foo), 忽略 DB row.name 可能残留的老值.
    name: fileBasenameNoExt(row.path),
    path: row.path,
    updatedAt: new Date(row.updatedAt).toISOString(),
    createdAt: new Date(row.createdAt).toISOString(),
    workspaceId: null,
    folderId: row.folderId,
    isFavorited: row.isStarred,
    isOwner: true,
    isArchived: row.isArchived,
    exists: row.exists,
    metadata: { starred: row.isStarred, tags: row.tags },
    stats: { nodeCount: row.nodeCount, size: row.size },
    nodeCount: row.nodeCount,
    size: row.size,
  }
}

interface UseCloudProjectsOptions {
  searchText?: string
  sortType?: "recent" | "created" | "name" | "starred"
  folderId?: string
  workspaceId?: string
  owner?: "me" | "all"
  onProjectsChanged?: () => void
}

export function openPendingProject(title: string, tree: MindMapNodeTree): string {
  const tempId = pendingProjects.stash({ title, tree })
  useTabs.getState().openTab({ id: tempId, kind: "draft", title })
  return tempId
}

export function useCloudProjects(opts: UseCloudProjectsOptions = {}) {
  const { searchText = "", sortType = "recent", folderId, onProjectsChanged } = opts
  const [rows, setRows] = useState<ProjectRow[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)

  const refreshProjects = useCallback(async () => {
    try {
      const list = await listProjects()
      setRows(list)
    } catch (error) {
      logger.error("加载项目失败", error)
    }
  }, [])

  const bumpCount = useProjectsEvents(s => s.bumpCount)
  useEffect(() => {
    let mounted = true
    // eslint-disable-next-line react-hooks/set-state-in-effect -- refresh state accompanies the external repository read
    setLoading(true)
    listProjects()
      .then(list => {
        if (mounted) setRows(list)
      })
      .catch(err => logger.error("加载项目失败", err))
      .finally(() => {
        if (mounted) setLoading(false)
      })
    return () => {
      mounted = false
    }
  }, [bumpCount])

  const projects = useMemo(() => {
    let items = rows.map(toCloud)
    if (folderId) items = items.filter(p => p.folderId === folderId)
    if (searchText) {
      const q = searchText.toLowerCase()
      items = items.filter(p => p.name.toLowerCase().includes(q))
    }
    items.sort((a, b) => {
      if (sortType === "starred") {
        const diff = (b.isFavorited ? 1 : 0) - (a.isFavorited ? 1 : 0)
        if (diff !== 0) return diff
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      }
      if (sortType === "created")
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      if (sortType === "name") return a.name.localeCompare(b.name)
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    })
    return items
  }, [rows, folderId, searchText, sortType])
  const createProject = useCallback(
    async (name?: string) => {
      if (creating) return
      setCreating(true)
      try {
        const title = name?.trim() || i18next.t("mindmap.editor.newProjectTitle")
        openPendingProject(title, defaultMindmapData)
        onProjectsChanged?.()
      } catch (error) {
        logger.error("创建失败", error)
        toast.error(i18next.t("mindmap.editor.createFailed"))
      } finally {
        setCreating(false)
      }
    },
    [creating, onProjectsChanged]
  )

  const renameProject = useCallback(
    async (project: CloudProjectWithStats, newName: string) => {
      const renamed = await renameProjectFile(project.id, newName)
      notifyProjectRenamed({ id: project.id, ...renamed })
      useTabs.getState().renameProjectTabs(project.id, renamed.name)
      await refreshProjects()
      onProjectsChanged?.()
    },
    [onProjectsChanged, refreshProjects]
  )

  const deleteProject = useCallback(
    async (project: CloudProjectWithStats) => {
      const openSession = projectSessionRegistry.get(project.id)
      if (openSession) {
        throw new Error(
          openSession.getState().dirty
            ? "请先保存或关闭该导图，再从 ZoeyMind 中移除"
            : "请先关闭该导图，再从 ZoeyMind 中移除"
        )
      }
      await unregisterProject(project.id)
      await refreshProjects()
      onProjectsChanged?.()
    },
    [onProjectsChanged, refreshProjects]
  )

  const toggleFavorite = useCallback(
    async (project: CloudProjectWithStats) => {
      await setStarred(project.id, !project.isFavorited)
      await refreshProjects()
    },
    [refreshProjects]
  )

  return {
    isAuthenticated: true,
    projects,
    loading,
    creating,
    renameLoading: false,
    deleteLoading: false,
    refreshProjects,
    createProject,
    renameProject,
    deleteProject,
    toggleFavorite,
  }
}
