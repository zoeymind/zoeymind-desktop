/** 协作相关类型占位 —— 桌面端 no-op。 */
export type CollaborationUserInfo = { id: string; name: string; avatar?: string }
export type CursorPosition = { x: number; y: number }
export type AwarenessSync = unknown
export type CooperatePlugin = unknown

export function isWaitingForCollaboration(mindMap: unknown): boolean {
  void mindMap
  return false
}
