/** 协作管理 —— 桌面端 no-op stub。保留导出让 MindMapCanvas 编译不改 JSX。 */
import { useMemo } from "react"

export interface CollaborationState {
  status: "idle" | "connecting" | "connected" | "disconnected"
  synced: boolean
  initialSyncDone: boolean
  users: []
}

const IDLE: CollaborationState = {
  status: "idle",
  synced: true,
  initialSyncDone: true,
  users: [],
}

export function useCollaborationManager(
  userInfo: unknown,
  updateProgress?: unknown
): CollaborationState {
  void userInfo
  void updateProgress
  return useMemo(() => IDLE, [])
}
