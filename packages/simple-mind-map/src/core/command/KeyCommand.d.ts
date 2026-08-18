import type MindMap from '../../index'
export default class KeyCommand {
  opt: {
    mindMap: MindMap
    [key: string]: unknown
  }
  mindMap: MindMap
  shortcutMap: Record<string, Array<(...args: unknown[]) => void>>
  shortcutMapCache: Record<string, Array<(...args: unknown[]) => void>>
  isPause: boolean
  isInSvg: boolean
  isStopCheckInSvg: boolean
  constructor(opt: any)
  extendKeyMap(key: any, code: any): void
  removeKeyMap(key: any): void
  pause(): void
  recovery(): void
  save(): void
  restore(): void
  stopCheckInSvg(): void
  recoveryCheckInSvg(): void
  bindEvent(): void
  unBindEvent(): void
  defaultEnableCheck(e: any): boolean
  onKeydown(e: any): void
  checkKey(e: any, key: any): boolean
  getOriginEventCodeArr(e: any): any[]
  hasCombinationKey(e: any): any
  getKeyCodeArr(key: any): any[]
  /**
   * Enter
   * Tab | Insert
   * Shift + a
   */
  addShortcut(key: any, fn: any): void
  removeShortcut(key: any, fn: any): void
  getShortcutFn(key: any): any[]
}
