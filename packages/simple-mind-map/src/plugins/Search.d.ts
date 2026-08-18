interface MindMapInstance {
  on(event: string, handler: Function): void
  off(event: string, handler: Function): void
  emit(event: string, ...args: unknown[]): void
  opt: Record<string, unknown> & {
    readonly: boolean
    isOnlySearchCurrentRenderNodes: boolean
  }
  renderer: Record<string, unknown> & {
    root: Record<string, unknown>
    renderTree: Record<string, unknown>
    findNodeByUid(uid: string): Record<string, unknown> | undefined
    setNodeDataRender(
      node: Record<string, unknown>,
      data: Record<string, unknown>,
      flag: boolean
    ): void
  }
  command: Record<string, unknown> & {
    addHistory(): void
  }
  keyCommand: Record<string, unknown> & {
    stopCheckInSvg(): void
    recoveryCheckInSvg(): void
  }
  execCommand(command: string, ...args: unknown[]): void
  render(): void
}
declare class Search {
  static instanceName: string
  mindMap: MindMapInstance
  isSearching: boolean
  searchText: string
  matchNodeList: Record<string, unknown>[]
  currentIndex: number
  notResetSearchText: boolean
  isJumpNext: boolean
  constructor({ mindMap }: { mindMap: MindMapInstance })
  bindEvent(): void
  unBindEvent(): void
  onDataChange(): void
  onModeChange(mode: string): void
  search(text: string, callback?: () => void): void
  updateMatchNodeList(list: Record<string, unknown>[]): void
  endSearch(): void
  doSearch(): void
  isNodeInstance(node: Record<string, unknown>): boolean
  searchNext(callback: () => void, index?: number): void
  clearHighlightOnReadonly(): void
  jump(index: number, callback?: () => void): void
  replace(replaceText: string, jumpNext?: boolean): void
  replaceAll(replaceText: string): void
  escapeRegExp(string: string): string
  getReplacedText(node: Record<string, unknown>, searchText: string, replaceText: string): string
  emitEvent(): void
  beforePluginRemove(): void
  beforePluginDestroy(): void
}
export default Search
