import type { CollaborationState } from "./useCollaborationManager"

/**
 * 全局 Loading 的展示决策。
 * - hide: 不显示（画布已就绪或不应显示）
 * - show: 显示全局 Loading，并使用对应 tipKey + 进度
 * - complete: 已就绪；触发 updateProgress(100) 并准备 1s 后收起
 */
export type MindMapLoadingDecision =
  { kind: "hide" } | { kind: "show"; tipKey: string; progress: number } | { kind: "complete" }

export interface MindMapLoadingInput {
  workspaceId?: string
  cloudMode: boolean
  hasMindMap: boolean
  loadError: string | null
  collaboration: Pick<CollaborationState, "status" | "synced" | "initialSyncDone"> | null
  waitingForCollaboration: boolean
}

/**
 * 决定思维导图全局 Loading 的展示。
 *
 * 关键点：首次同步完成（initialSyncDone=true）后，云端模式不再因连接/同步状态变化
 * 而显示全局 Loading——交给画布右上角的轻量"同步中" Toast 处理，避免切 Tab 回来时
 * 重新覆盖画布。
 */
export function resolveMindMapLoading(input: MindMapLoadingInput): MindMapLoadingDecision {
  const { workspaceId, cloudMode, hasMindMap, loadError, collaboration, waitingForCollaboration } =
    input

  if (!workspaceId) return { kind: "hide" }
  if (loadError) return { kind: "hide" }
  if (!hasMindMap) {
    return { kind: "show", tipKey: "mindmap.canvas.initializingCanvas", progress: 30 }
  }

  if (cloudMode) {
    // 首次同步完成 → 不再覆盖全局 Loading，交给轻量 Toast
    if (!collaboration?.initialSyncDone) {
      if (!collaboration) {
        return { kind: "show", tipKey: "mindmap.canvas.preparingCollaboration", progress: 75 }
      }
      if (collaboration.status === "connecting") {
        return { kind: "show", tipKey: "mindmap.canvas.connectingCollaboration", progress: 80 }
      }
      if (collaboration.status === "disconnected") {
        return { kind: "show", tipKey: "mindmap.canvas.reconnectingCollaboration", progress: 50 }
      }
      if (!collaboration.synced) {
        return { kind: "show", tipKey: "mindmap.canvas.syncingData", progress: 85 }
      }
    }
  } else if (waitingForCollaboration) {
    return { kind: "show", tipKey: "mindmap.canvas.syncingData", progress: 85 }
  }

  return { kind: "complete" }
}
