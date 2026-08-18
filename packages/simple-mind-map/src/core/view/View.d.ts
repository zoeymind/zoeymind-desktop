import type MindMap from '../../index'
declare class View {
  opt: {
    mindMap: MindMap
    enableFreeDrag?: boolean
    mousewheelAction?: string
    [key: string]: unknown
  }
  mindMap: MindMap
  scale: number
  sx: number
  sy: number
  x: number
  y: number
  firstDrag: boolean
  constructor(opt?: {
    mindMap: MindMap
    enableFreeDrag?: boolean
    mousewheelAction?: string
    [key: string]: unknown
  })
  bind(): void
  getTransformData(): {
    transform: import('@svgdotjs/svg.js').MatrixExtract
    state: {
      scale: number
      x: number
      y: number
      sx: number
      sy: number
    }
  }
  setTransformData(viewData: any): void
  translateXY(x: any, y: any): void
  translateX(step: any): void
  translateXTo(x: any): void
  translateY(step: any): void
  translateYTo(y: any): void
  transform(): void
  reset(): void
  narrow(cx?: number, cy?: number, isTouchPad?: boolean): void
  enlarge(cx?: number, cy?: number, isTouchPad?: boolean): void
  scaleInCenter(scale: any, cx: any, cy: any): void
  setScale(scale: number, cx?: number, cy?: number): void
  fit(getRbox?: () => undefined, enlarge?: boolean, fitPadding?: number): void
  checkNeedMindMapInCanvas(): boolean
  limitMindMapInCanvas(): void
  getPositionLimit(): {
    scale: number
    left: number
    right: number
    top: number
    bottom: number
  }
  emitEvent(type: any): void
}
export default View
