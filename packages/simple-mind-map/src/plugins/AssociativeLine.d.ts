interface MindMapInstance {
  on(event: string, handler: Function): void
  off(event: string, handler: Function): void
  emit(event: string, ...args: unknown[]): void
  opt: Record<string, unknown>
  draw: {
    transform(): Record<string, number>
  }
  toPos(
    x: number,
    y: number
  ): {
    x: number
    y: number
  }
  renderer: {
    root: Record<string, unknown> | null
    activeNodeList: Array<Record<string, unknown>>
  }
  command: {
    add(name: string, handler: Function): void
    remove(name: string, handler: Function): void
  }
  keyCommand: {
    addShortcut(keys: string, handler: Function): void
    removeShortcut(keys: string, handler: Function): void
  }
  execCommand(command: string, ...args: unknown[]): void
  addEditNodeClass(cls: string): void
  deleteEditNodeClass(cls: string): void
  associativeLineDraw?: Record<string, Function>
}
interface SVGLike {
  [key: string]: unknown
  stroke(props: Record<string, unknown>): this
  fill(props: Record<string, unknown>): this
  plot(path: string): this
  marker(name: string, marker: unknown): this
  marker(w: number, h: number, add: (m: SVGAddLike) => void): unknown
  remove(): void
  hide(): void
  show(): void
  front(): void
  back(): void
  forward(): void
  click(handler: (e: MouseEvent) => void): void
  dblclick(handler: () => void): void
  find(s: string): Array<SVGLike>
  ref(x: number, y: number): void
  size(w: number, h: number): void
  attr(props: Record<string, unknown>): void
  path(s: string): SVGLike
  path(): SVGLike
  line(): SVGLike
  css(props: Record<string, unknown>): this
  clear(): void
}
interface SVGAddLike {
  ref(x: number, y: number): void
  size(w: number, h: number): void
  attr(props: Record<string, unknown>): void
  path(s: string): SVGLike
}
interface NodeLike {
  [key: string]: unknown
  uid?: string
  left?: number
  top?: number
  width?: number
  height?: number
  getData<T = unknown>(key?: string): T
  getStyle(prop: string): unknown
  group?: SVGLike
}
declare class AssociativeLine {
  static instanceName: string
  mindMap: MindMapInstance
  associativeLineDraw: SVGLike
  isNotRenderAllLines: boolean
  lineList: Array<[SVGLike, SVGLike, SVGLike, NodeLike, NodeLike]>
  activeLine:
    | [SVGLike, SVGLike, SVGLike, NodeLike, NodeLike]
    | [SVGLike, SVGLike, SVGLike, NodeLike, NodeLike, SVGLike]
    | null
  isCreatingLine: boolean
  creatingStartNode: NodeLike | null
  creatingLine: SVGLike | null
  overlapNode: NodeLike | null
  isNodeDragging: boolean
  controlLine1: SVGLike | null
  controlLine2: SVGLike | null
  controlPoint1: SVGLike | null
  controlPoint2: SVGLike | null
  controlPointDiameter: number
  isControlPointMousedown: boolean
  mousedownControlPointKey: string
  controlPointMousemoveState: Record<string, unknown>
  showTextEdit: boolean
  createControlNodes: (node: NodeLike, toNode: NodeLike) => void
  createOneControlNode: (pointKey: string, node: NodeLike, toNode: NodeLike) => SVGLike
  onControlPointMousedown: (e: MouseEvent, pointKey: string) => void
  onControlPointMousemove: (e: MouseEvent) => void
  onControlPointMouseupHandle: (e: MouseEvent) => void
  resetControlPoint: () => void
  renderControls: (
    startPoint: Record<string, unknown>,
    endPoint: Record<string, unknown>,
    point1: Record<string, unknown>,
    point2: Record<string, unknown>,
    node: NodeLike,
    toNode: NodeLike
  ) => void
  removeControls: () => void
  hideControls: () => void
  showControls: () => void
  updataAassociativeLine: (
    startPoint: Record<string, unknown>,
    endPoint: Record<string, unknown>,
    point1: Record<string, unknown>,
    point2: Record<string, unknown>,
    activeLine: Record<string, unknown>
  ) => void
  getText: (node: NodeLike, toNode: NodeLike) => string | undefined
  createText: (data: Record<string, unknown>) => SVGLike
  styleText: (textNode: SVGLike, node: NodeLike, toNode: NodeLike) => void
  showEditTextBox: (g: SVGLike) => void
  setIsShowTextEdit: (val: boolean) => void
  removeTextEditEl: () => void
  hideEditTextBox: () => void
  onControlPointMouseup: (e: MouseEvent) => void
  updateTextPos: (path: SVGLike, text: SVGLike) => void
  renderText: (
    str: string | undefined,
    path: SVGLike,
    text: SVGLike,
    node: NodeLike,
    toNode: NodeLike
  ) => void
  onScale: () => void
  constructor(opt?: Record<string, unknown>)
  bindEvent(): void
  unBindEvent(): void
  getStyleConfig(node: NodeLike, toNode?: NodeLike): Record<string, unknown>
  onBeforeDestroy(): void
  onDrawClick(): void
  onNodeClick(node: NodeLike): void
  createMarker(callback?: (p: SVGLike) => void): unknown
  updateAllLinesPos(
    node: NodeLike,
    toNode: NodeLike,
    associativeLinePoint: Record<string, unknown>
  ): {
    x: any
    y: any
    dir: string
  }[]
  renderAllLines(): void
  drawLine(
    startPoint: Record<string, unknown>,
    endPoint: Record<string, unknown>,
    node: NodeLike,
    toNode: NodeLike
  ): void
  updateActiveLineStyle(): void
  setActiveLine({
    path,
    clickPath,
    markerPath,
    text,
    node,
    toNode,
    startPoint,
    endPoint,
    controlPoints
  }: Record<string, unknown>): void
  removeAllLines(): void
  createLineFromActiveNode(): void
  createLine(fromNode: NodeLike): void
  cancelCreateLine(): void
  onMousemove(e: MouseEvent): void
  updateCreatingLine(e: MouseEvent): void
  getTransformedEventPos(e: MouseEvent): {
    x: number
    y: number
  }
  getNodePos(node: Record<string, number>): {
    left: number
    top: number
    translateLeft: number
    translateTop: number
    width: number
    height: number
  }
  checkOverlapNode(x: number, y: number): void
  completeCreateLine(node: NodeLike): void
  addLine(fromNode: NodeLike, toNode: NodeLike): void
  removeLine(): void
  clearActiveLine(): void
  onNodeDragging(): void
  onNodeDragend(): void
  front(): void
  back(): void
  beforePluginRemove(): void
  beforePluginDestroy(): void
}
export default AssociativeLine
