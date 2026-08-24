/** Desktop project-list operations backed by SqlProjectRepo. */
import { useCallback, useEffect, useMemo, useState } from "react"
import { logger } from "@zoeymind/logger"
import { i18next } from "@zoeymind/i18n"
import { toast } from "@/shared/app-shared"
import { defaultMindmapData } from "@zoeymind/shared"
import type { MindMapNodeTree } from "simple-mind-map"
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
import { toLocalProject } from "../project-model"
import type { LocalProject } from "../project-model"

export type { LocalProject } from "../project-model"

interface UseLocalProjectsOptions {
  searchText?: string
  sortType?: "recent" | "created" | "name" | "starred"
  folderId?: string
  onProjectsChanged?: () => void
}

export function openPendingProject(title: string, tree: MindMapNodeTree): string {
  const tempId = pendingProjects.stash({ title, tree })
  useTabs.getState().openTab({ id: tempId, kind: "draft", title })
  return tempId
}

export function useLocalProjects(opts: UseLocalProjectsOptions = {}) {
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
    let items = rows.map(toLocalProject)
    if (folderId) items = items.filter(project => project.folderId === folderId)
    if (searchText) {
      const query = searchText.toLowerCase()
      items = items.filter(project => project.name.toLowerCase().includes(query))
    }
    items.sort((left, right) => {
      if (sortType === "starred") {
        const starredOrder = Number(right.isStarred) - Number(left.isStarred)
        if (starredOrder !== 0) return starredOrder
      }
      if (sortType === "created") return right.createdAt.getTime() - left.createdAt.getTime()
      if (sortType === "name") return left.name.localeCompare(right.name)
      return right.updatedAt.getTime() - left.updatedAt.getTime()
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
    async (project: LocalProject, newName: string) => {
      const renamed = await renameProjectFile(project.id, newName)
      notifyProjectRenamed({ id: project.id, ...renamed })
      useTabs.getState().renameProjectTabs(project.id, renamed.name)
      await refreshProjects()
      onProjectsChanged?.()
    },
    [onProjectsChanged, refreshProjects]
  )

  const deleteProject = useCallback(
    async (project: LocalProject) => {
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
    async (project: LocalProject) => {
      await setStarred(project.id, !project.isStarred)
      await refreshProjects()
    },
    [refreshProjects]
  )

  return {
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
