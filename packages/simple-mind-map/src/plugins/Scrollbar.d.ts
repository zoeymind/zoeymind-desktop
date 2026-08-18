interface MindMapInstance {
  on(event: string, handler: Function, context?: unknown): void
  off(event: string, handler: Function): void
  emit(event: string, ...args: unknown[]): void
  draw: Record<string, unknown> & {
    rbox(): Record<string, unknown>
    transform(): Record<string, unknown>
  }
  renderer: Record<string, unknown>
  view: Record<string, unknown> & {
    translateYTo(y: number): void
    translateXTo(x: number): void
  }
  opt: Record<string, unknown>
  width: number
  height: number
  initWidth: number
  initHeight: number
  elRect: Record<string, unknown> & {
    left: number
    top: number
  }
}
interface ScrollbarData {
  vertical: {
    top: number
    height: number
  }
  horizontal: {
    left: number
    width: number
  }
}
declare class Scrollbar {
  static instanceName: string
  private mindMap
  private scrollbarWrapSize
  private chartHeight
  private chartWidth
  private currentScrollType
  private isMousedown
  private mousedownPos
  private mousedownScrollbarPos
  constructor(opt: { mindMap: MindMapInstance })
  reset(): void
  bindEvent(): void
  unBindEvent(): void
  updateScrollbar(): void
  emitEvent(data: ScrollbarData): void
  setScrollBarWrapSize(width: number, height: number): void
  calculationScrollbar(): ScrollbarData
  onMousedown(e: MouseEvent, type: string): void
  onMousemove(e: MouseEvent): void
  onMouseup(): void
  updateMindMapView(type: string, offset: number): void
  onClick(e: MouseEvent, type: string): void
  beforePluginRemove(): void
  beforePluginDestroy(): void
}
export default Scrollbar
