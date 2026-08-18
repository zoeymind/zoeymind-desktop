import { Rect } from '@svgdotjs/svg.js'
declare function initDragHandle(): void
declare function onDragMousemoveHandle(e: any): void
declare function onDragMouseupHandle(): void
declare function createDragHandleNode(): Rect[]
declare function updateDragHandle(): void
declare const _default: {
  initDragHandle: typeof initDragHandle
  onDragMousemoveHandle: typeof onDragMousemoveHandle
  onDragMouseupHandle: typeof onDragMouseupHandle
  createDragHandleNode: typeof createDragHandleNode
  updateDragHandle: typeof updateDragHandle
}
export default _default
