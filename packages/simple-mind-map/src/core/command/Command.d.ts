import type MindMap from '../../index'
declare class Command {
  opt: {
    mindMap: import('../..').default
    [key: string]: unknown
  }
  mindMap: import('../..').default
  commands: Record<string, Array<(...args: unknown[]) => void>>
  history: string[]
  activeHistoryIndex: number
  originAddHistory: (...args: unknown[]) => void
  isPause: boolean
  constructor(opt?: { mindMap: MindMap; [key: string]: unknown })
  pause(): void
  recovery(): void
  clearHistory(): void
  registerShortcutKeys(): void
  static NODE_ADD_COMMANDS: string[]
  getNodeCount(): number
  exec(name: any, ...args: any[]): void
  add(name: any, fn: any): void
  remove(name: any, fn: any): void
  addHistory(): void
  back(step?: number): any
  forward(step?: number): any
  getCopyData(): any
  removeDataUid(data: any): any
  emitDataUpdatesEvent(lastDataStr: any, dataStr: any): void
}
export default Command
