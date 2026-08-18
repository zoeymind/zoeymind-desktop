/**
 * useRecentProjects —— 最近打开的项目 (按 last_opened_at desc), 顶栏 File 菜单用.
 *
 * 数据源: SqlProjectRepo listProjects(). 用 useProjectsEvents.bumpCount 触发刷新
 * (openTab 会 touchLastOpened -> bump; save 也会 bump).
 */
import { useEffect, useState } from 'react'
import { listProjects, useProjectsEvents, type ProjectRow } from '@/shared/native'

export function useRecentProjects(limit = 10): ProjectRow[] {
  const [rows, setRows] = useState<ProjectRow[]>([])
  const bumpCount = useProjectsEvents(s => s.bumpCount)

  useEffect(() => {
    let mounted = true
    void (async () => {
      try {
        const list = await listProjects()
        if (!mounted) return
        // last_opened_at desc, null 最后
        const sorted = [...list].sort((a, b) => {
          const aT = a.lastOpenedAt ?? 0
          const bT = b.lastOpenedAt ?? 0
          return bT - aT
        })
        setRows(sorted.slice(0, limit))
      } catch {
        if (mounted) setRows([])
      }
    })()
    return () => {
      mounted = false
    }
  }, [bumpCount, limit])

  return rows
}
