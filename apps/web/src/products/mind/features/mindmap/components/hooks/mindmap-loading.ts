/**
 * 全局 Loading 的展示决策 —— 桌面端只留本地路径。
 *
 * 云版本还需要判定 collaboration 连接/同步状态，这里去掉。
 */
export type MindMapLoadingDecision =
  | { kind: 'hide' }
  | { kind: 'show'; tipKey: string; progress: number }
  | { kind: 'complete' }

export interface MindMapLoadingInput {
  workspaceId?: string
  hasMindMap: boolean
  loadError: string | null
}

export function resolveMindMapLoading(input: MindMapLoadingInput): MindMapLoadingDecision {
  const { workspaceId, hasMindMap, loadError } = input
  if (!workspaceId) return { kind: 'hide' }
  if (loadError) return { kind: 'hide' }
  if (!hasMindMap) {
    return { kind: 'show', tipKey: 'mindmap.canvas.initializingCanvas', progress: 30 }
  }
  return { kind: 'complete' }
}
