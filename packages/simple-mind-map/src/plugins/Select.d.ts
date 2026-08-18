import AutoMove from '../utils/AutoMove'
interface MindMapInstance {
  on(event: string, handler: Function): void
  off(event: string, handler: Function): void
  emit(event: string, ...args: unknown[]): void
  opt: Record<string, unknown> & {
    readonly: boolean
    mousedownEventPreventDefault: boolean
    useLeftKeySelectionRightKeyDrag: boolean
  }
  renderer: Record<string, unknown> & {
    activeNodeList: Record<string, unknown>[]
    root: Record<string, unknown>
    addNodeToActiveList(node: Record<string, unknown>): void
    removeNodeFromActiveList(node: Record<string, unknown>): void
    emitNodeActiveEvent(): void
  }
  view: Record<string, unknown> & {
    x: number
    y: number
  }
  draw: Record<string, unknown> & {
    transform(): Record<string, unknown> & {
      scaleX: number
      scaleY: number
      translateX: number
      translateY: number
    }
  }
  svg: Record<string, unknown> & {
    polygon(): Record<string, unknown> & {
      stroke(style: Record<string, unknown>): Record<string, unknown>
      fill(style: Record<string, unknown>): Record<string, unknown>
      plot(points: number[][]): Record<string, unknown>
      remove(): void
    }
  }
  toPos(
    x: number,
    y: number
  ): {
    x: number
    y: number
  }
}
declare class Select {
  static instanceName: string
  mindMap: MindMapInstance
  rect:
    | (Record<string, unknown> & {
        plot(points: number[][]): void
        remove(): void
      })
    | null
  isMousedown: boolean
  mouseDownX: number
  mouseDownY: number
  mouseMoveX: number
  mouseMoveY: number
  isSelecting: boolean
  cacheActiveList: Record<string, unknown>[]
  autoMove: AutoMove
  lastTranslateX: number
  lastTranslateY: number
  constructor({ mindMap }: { mindMap: MindMapInstance })
  bindEvent(): void
  unBindEvent(): void
  onMousedown(e: MouseEvent): void
  onMousemove(e: MouseEvent): void
  onMouseup(): void
  onTranslate(x: number, y: number): void
  checkTriggerNodeActiveEvent(): void
  createRect(x: number, y: number): void
  updateRect(): void
  checkInNodes(): void
  hasSelectRange(): boolean
  beforePluginRemove(): void
  beforePluginDestroy(): void
}
export default Select
