/** 云项目列表 —— 桌面端 no-op。数据源改走本地 useProjects；本 hook 只是让 CloudProjectList/MoveDialog 之类的 import 不炸。 */
import { useMemo } from 'react'

export interface CloudProjectWithStats {
  id: string
  name: string
  updatedAt: string
  createdAt: string
  workspaceId: string | null
  folderId: string | null
  isFavorited: boolean
}

const NOOP_ASYNC = async () => undefined

export function useCloudProjects(_opts?: { workspaceId?: string; filter?: string }) {
  return useMemo(
    () => ({
      projects: [] as CloudProjectWithStats[],
      loading: false,
      isPending: false,
      refetch: NOOP_ASYNC,
      updateProject: NOOP_ASYNC,
      deleteProject: NOOP_ASYNC,
      toggleFavorite: NOOP_ASYNC
    }),
    []
  )
}
