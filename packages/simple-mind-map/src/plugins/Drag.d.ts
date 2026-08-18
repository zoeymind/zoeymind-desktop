import Base from '../layouts/Base'
import type MindMapNode from '../core/render/node/MindMapNode'
import AutoMove from '../utils/AutoMove'
interface SVGEl {
  remove(): void
  size(w: number, h: number): SVGEl
  hide(): SVGEl
  show(): SVGEl
  opacity(val: number): SVGEl
  css(prop: string, val: string | number): SVGEl
  fill(val: Record<string, unknown> | string): SVGEl
  stroke(val: Record<string, unknown>): SVGEl
  findOne(selector: string): SVGEl | null
  addClass(cls: string): void
  removeClass(cls: string): void
  radius?(r: number): SVGEl
  transform(): {
    translateX: number
    translateY: number
  }
  translate(x: number, y: number): void
  move(x: number, y: number): SVGEl
  clone(): SVGEl
  plot?(points: number[][]): void
}
declare class Drag extends Base {
  static instanceName: string
  autoMove: AutoMove
  isDragging: boolean
  mousedownNode: MindMapNode | null
  beingDragNodeList: MindMapNode[]
  nodeList: MindMapNode[]
  overlapNode: MindMapNode | null
  prevNode: MindMapNode | null
  nextNode: MindMapNode | null
  drawTransform: {
    scaleX: number
    scaleY: number
    translateX: number
    translateY: number
  } | null
  clone: SVGEl | null
  placeholder: SVGEl | null
  placeholderWidth: number
  placeholderHeight: number
  placeHolderLine: SVGEl | null
  placeHolderExtraLines: SVGEl[]
  offsetX: number
  offsetY: number
  isMousedown: boolean
  mouseDownX: number
  mouseDownY: number
  mouseMoveX: number
  mouseMoveY: number
  checkDragOffset: number
  minOffset: number
  horizontalIndicator: SVGEl | null
  constructor({ mindMap }: { mindMap: any })
  reset(): void
  bindEvent(): void
  unBindEvent(): void
  onNodeMousedown(node: any, e: any): void
  onMousemove(e: any): void
  onMouseup(e: any): Promise<void>
  removeNodeActive(node: any): void
  activateDraggedNodes(): void
  onMove(x: any, y: any, e: any): void
  handleStartMove(): Promise<void>
  nodeTreeToList(): void
  createCloneNode(): void
  removeCloneNode(): void
  removeExtraLines(): void
  checkOverlapNode(): void
  handleNodeByLayout(node: any): void
  handleOverlapNode(): void
  getNewChildNodeDir(node: any): any
  handleVerticalCheck(node: any, checkList: any, isReverse?: boolean): void
  handleHorizontalCheck(node: any, checkList: any): void
  getNodeDistanceToSiblingNode(
    checkList: any,
    node: any,
    nodeRect: any,
    dir: any
  ): {
    prevBrother: any
    prevBrotherOffset: number
    nextBrother: any
    nextBrotherOffset: number
  }
  setPlaceholderRect({
    x,
    y,
    dir,
    rotate,
    notRenderLine
  }: {
    x: number
    y: number
    dir?: string
    rotate?: boolean
    notRenderLine?: boolean
  }): void
  checkIsOverlap({
    node,
    dir,
    prevBrotherOffset,
    nextBrotherOffset,
    size,
    pos,
    nodeRect
  }: {
    node: any
    dir: any
    prevBrotherOffset: any
    nextBrotherOffset: any
    size: any
    pos: any
    nodeRect: any
  }): void
  handleLogicalStructure(node: any): void
  handleMindMap(node: any): void
  handleOrganizationStructure(node: any): void
  handleCatalogOrganization(node: any): void
  handleTimeLine(node: any): void
  handleTimeLine2(node: any): void
  handleFishbone(node: any): void
  commonGetNodeCheckList(node: any): any[]
  getNodeRect(node: any): {
    left: any
    top: any
    right: number
    bottom: number
    originWidth: any
    originHeight: any
    originLeft: any
    originTop: any
    originBottom: any
    originRight: any
  }
  checkIsInBeingDragNodeList(node: any): boolean
  beforePluginRemove(): void
  beforePluginDestroy(): void
}
export default Drag
