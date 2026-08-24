/**
 * useProjects —— 桌面端本地版：SqlProjectRepo。表面对齐原产品版。
 */
import { useState, useEffect, useMemo, useCallback } from "react"
import { logger } from "@zoeymind/logger"
import { listProjects, useProjectsEvents } from "@/shared/native"
import { toLocalProject } from "../project-model"
import type { LocalProject } from "../project-model"

export type SortType = "recent" | "created" | "name" | "starred"

export type { LocalProject } from "../project-model"

export function useProjects() {
  const [projects, setProjects] = useState<LocalProject[]>([])
  const [loading, setLoading] = useState(true)
  const [searchText, setSearchText] = useState("")
  const [sortType, setSortType] = useState<SortType>("recent")
  const bumpCount = useProjectsEvents(s => s.bumpCount)

  // 只维护本地 loading, 不动全局 Loading 遮罩:
  // Home 面板是 keep-alive 挂载, 每次 bumpProjects() (保存/删除等) 都会 refetch,
  // 触发全局 Loading 会盖在编辑器 tab 上闪一下 (VS Code 后台列表刷新也是静默的).
  useEffect(() => {
    const controller = { isMounted: true }
    const run = async () => {
      if (!controller.isMounted) return
      setLoading(true)
      try {
        const rows = await listProjects()
        if (controller.isMounted) setProjects(rows.map(toLocalProject))
      } catch (error) {
        logger.error("加载项目失败:", error)
      } finally {
        if (controller.isMounted) setLoading(false)
      }
    }
    run()
    return () => {
      controller.isMounted = false
    }
  }, [bumpCount])

  const refreshProjects = useCallback(async () => {
    try {
      const rows = await listProjects()
      setProjects(rows.map(toLocalProject))
    } catch (error) {
      logger.error("刷新项目列表失败:", error)
    }
  }, [])

  const setSearch = useCallback((text: string) => setSearchText(text), [])
  const clearSearch = useCallback(() => setSearchText(""), [])
  const handleSortChange = useCallback((sortKey: string) => setSortType(sortKey as SortType), [])

  const filteredAndSortedProjects = useMemo(() => {
    const q = searchText.toLowerCase()
    const filtered = q ? projects.filter(p => p.name.toLowerCase().includes(q)) : projects.slice()
    return filtered.sort((a, b) => {
      if (sortType === "starred") {
        const diff = Number(b.isStarred) - Number(a.isStarred)
        if (diff !== 0) return diff
        return b.updatedAt.getTime() - a.updatedAt.getTime()
      }
      switch (sortType) {
        case "recent":
          return b.updatedAt.getTime() - a.updatedAt.getTime()
        case "created":
          return b.createdAt.getTime() - a.createdAt.getTime()
        case "name":
          return a.name.localeCompare(b.name)
        default:
          return 0
      }
    })
  }, [projects, searchText, sortType])

  return {
    projects,
    filteredProjects: filteredAndSortedProjects,
    loading,
    searchText,
    sortType,
    setSearch,
    clearSearch,
    refreshProjects,
    handleSortChange,
  }
}

export default useProjects
