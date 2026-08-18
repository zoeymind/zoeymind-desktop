import type MindMap from '../index'
declare class AutoMove {
  mindMap: MindMap
  autoMoveTimer: ReturnType<typeof setTimeout> | null
  constructor(mindMap: MindMap)
  onMove(x: number, y: number, callback?: () => void, handle?: (...args: unknown[]) => void): void
  startAutoMove(
    x: number,
    y: number,
    callback: () => void,
    handle: (...args: unknown[]) => void
  ): void
  clearAutoMoveTimer(): void
}
export default AutoMove
