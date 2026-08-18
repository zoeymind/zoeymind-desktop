interface MindMapInstance {
  el: HTMLElement
  on(event: string, handler: Function): void
  off(event: string, handler: Function): void
  emit(event: string, ...args: unknown[]): void
  opt: Record<string, unknown>
  view: {
    getTransformData(): Record<string, unknown>
    setTransformData(data: Record<string, unknown>): void
    fit(callback: () => Record<string, unknown>, center?: boolean, margin?: number): void
    expandToNodeUid(uid: string, callback?: () => void): void
  }
  renderer: {
    renderTree: Record<string, unknown> | null
    findNodeByUid(uid: string): Record<string, unknown> | null
    forceLoadNode(): void
    expandToNodeUid(uid: string, callback?: () => void): void
  }
  command: {
    recovery(): void
  }
  keyCommand: {
    recovery(): void
  }
  getData(): Record<string, unknown> | null
  updateData(data: Record<string, unknown>): void
  execCommand(command: string, ...args: unknown[]): void
  render(callback?: () => void): void
}
declare class Demonstrate {
  static instanceName: string
  mindMap: MindMapInstance
  isInDemonstrate: boolean
  stepList: Array<Record<string, unknown>>
  currentStepIndex: number
  currentStepNode: Record<string, unknown> | null
  currentUnderlineTextData: {
    index: number
    list: Array<{
      node: HTMLElement
    }>
    length: number
  } | null
  tmpStyleEl: HTMLElement | null
  highlightEl: HTMLElement | null
  transformState: Record<string, unknown> | null
  renderTree: Record<string, unknown> | null
  config: Record<string, unknown>
  needRestorePerformanceMode: boolean
  constructor(opt: { mindMap: MindMapInstance; [key: string]: unknown })
  onConfigUpdate(opt: Record<string, unknown>): void
  enter(): void
  _enter(): void
  exit(): void
  pausePerformanceMode(): void
  restorePerformanceMode(): void
  addTmpStyles(): void
  removeTmpStyles(): void
  createHighlightEl(): void
  removeHighlightEl(): void
  updateHighlightEl({ left, top, width, height }: Record<string, number>): void
  bindEvent(): void
  bindFullscreenEvent(): void
  unBindEvent(): void
  onFullscreenChange(): void
  onKeydown(e: KeyboardEvent): void
  prev(): void
  next(): void
  showNextUnderlineText(): void
  jump(index: number): void
  getStepList(): void
  beforePluginRemove(): void
  beforePluginDestroy(): void
}
export default Demonstrate
