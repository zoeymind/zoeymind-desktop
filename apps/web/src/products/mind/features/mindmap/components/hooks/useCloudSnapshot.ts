/** 云快照 —— 桌面端 no-op。本地快照走 FormatPanel/SnapshotPanel 里的 projectDB 分支（我们已把 projectDB stub 掉，此路径也不生效）。 */
import { useMemo } from 'react'

export interface CloudSnapshotDetail {
  id: string
  title: string
  createdAt: string
  kind: 'manual' | 'auto'
}

const NOOP_ASYNC = async () => undefined

export function useCloudSnapshot(_workspaceId: string | undefined) {
  return useMemo(
    () => ({
      snapshots: [] as CloudSnapshotDetail[],
      isLoading: false,
      createSnapshot: NOOP_ASYNC,
      deleteSnapshot: NOOP_ASYNC,
      restoreSnapshot: NOOP_ASYNC,
      refetch: NOOP_ASYNC
    }),
    []
  )
}
