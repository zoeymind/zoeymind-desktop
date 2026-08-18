import EventEmitter from 'eventemitter3'
declare class Event extends EventEmitter {
  opt: {
    mindMap: import('../../index').default
    [key: string]: unknown
  }
  mindMap: import('../../index').default
  isLeftMousedown: boolean
  isRightMousedown: boolean
  isMiddleMousedown: boolean
  mousedownPos: {
    x: number
    y: number
  }
  mousemovePos: {
    x: number
    y: number
  }
  mousemoveOffset: {
    x: number
    y: number
  }
  constructor(opt?: Event['opt'])
  bindFn(): void
  bind(): void
  unbind(): void
  onDrawClick(e: any): void
  onBodyMousedown(e: any): void
  onBodyClick(e: any): void
  onSvgMousedown(e: any): void
  onMousedown(e: any): void
  onMousemove(e: any): void
  onMouseup(e: any): void
  onNodeMouseup(): void
  onMousewheel(e: any): void
  onContextmenu(e: any): void
  onKeyup(e: any): void
  onMouseenter(e: any): void
  onMouseleave(e: any): void
}
export default Event
