interface MindMapInstance {
  el: HTMLElement
  on(event: string, handler: Function): void
  off(event: string, handler: Function): void
  emit(event: string, ...args: unknown[]): void
  opt: Record<string, unknown> & {
    disableTouchZoom: boolean
    minTouchZoomScale: number
    maxTouchZoomScale: number
  }
  view: Record<string, unknown> & {
    scale: number
    x: number
    y: number
    transform(): void
  }
  toPos(
    x: number,
    y: number
  ): {
    x: number
    y: number
  }
}
declare class TouchEvent {
  static instanceName: string
  mindMap: MindMapInstance
  touchesNum: number
  singleTouchstartEvent: globalThis.Touch | null
  clickNum: number
  touchStartScaleView: Record<string, unknown> | null
  lastTouchStartPosition: {
    x: number
    y: number
  } | null
  lastTouchStartDistance: number
  gestureActive: boolean
  constructor({ mindMap }: { mindMap: MindMapInstance })
  bindEvent(): void
  unBindEvent(): void
  isEventOwned(e: globalThis.TouchEvent): boolean
  onTouchstart(e: globalThis.TouchEvent): void
  onTouchmove(e: globalThis.TouchEvent): void
  onTouchcancel(e: globalThis.TouchEvent): void
  onTouchend(e: globalThis.TouchEvent): void
  dispatchMouseEvent(eventName: string, target: EventTarget, e?: globalThis.Touch): void
  beforePluginRemove(): void
  beforePluginDestroy(): void
}
export default TouchEvent
