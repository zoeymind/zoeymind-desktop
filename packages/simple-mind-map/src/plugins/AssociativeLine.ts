import { walk, bfsWalk, throttle } from '../utils'
import { v4 as uuid } from 'uuid'
import {
  getAssociativeLineTargetIndex,
  computeCubicBezierPathPoints,
  cubicBezierPath,
  getNodePoint,
  computeNodePoints,
  getNodeLinePath
} from './associativeLine/associativeLineUtils'
import associativeLineControlsMethods from './associativeLine/associativeLineControls'
import associativeLineTextMethods from './associativeLine/associativeLineText'

interface MindMapInstance {
  on(event: string, handler: Function): void
  off(event: string, handler: Function): void
  emit(event: string, ...args: unknown[]): void
  opt: Record<string, unknown>
  draw: { transform(): Record<string, number> }
  toPos(x: number, y: number): { x: number; y: number }
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

const styleProps = [
  'associativeLineWidth',
  'associativeLineColor',
  'associativeLineActiveWidth',
  'associativeLineActiveColor',
  'associativeLineDasharray',
  'associativeLineTextColor',
  'associativeLineTextFontSize',
  'associativeLineTextLineHeight',
  'associativeLineTextFontFamily'
]

const ASSOCIATIVE_LINE_TEXT_EDIT_WRAP = 'associative-line-text-edit-warp'

// 关联线插件
class AssociativeLine {
  declare static instanceName: string
  declare mindMap: MindMapInstance
  declare associativeLineDraw: SVGLike
  declare isNotRenderAllLines: boolean
  declare lineList: Array<[SVGLike, SVGLike, SVGLike, NodeLike, NodeLike]>
  declare activeLine:
    | [SVGLike, SVGLike, SVGLike, NodeLike, NodeLike]
    | [SVGLike, SVGLike, SVGLike, NodeLike, NodeLike, SVGLike]
    | null
  declare isCreatingLine: boolean
  declare creatingStartNode: NodeLike | null
  declare creatingLine: SVGLike | null
  declare overlapNode: NodeLike | null
  declare isNodeDragging: boolean
  declare controlLine1: SVGLike | null
  declare controlLine2: SVGLike | null
  declare controlPoint1: SVGLike | null
  declare controlPoint2: SVGLike | null
  declare controlPointDiameter: number
  declare isControlPointMousedown: boolean
  declare mousedownControlPointKey: string
  declare controlPointMousemoveState: Record<string, unknown>
  declare showTextEdit: boolean

  // Mixed-in methods from controls/text (assigned in constructor)
  declare createControlNodes: (node: NodeLike, toNode: NodeLike) => void
  declare createOneControlNode: (pointKey: string, node: NodeLike, toNode: NodeLike) => SVGLike
  declare onControlPointMousedown: (e: MouseEvent, pointKey: string) => void
  declare onControlPointMousemove: (e: MouseEvent) => void
  declare onControlPointMouseupHandle: (e: MouseEvent) => void
  declare resetControlPoint: () => void
  declare renderControls: (
    startPoint: Record<string, unknown>,
    endPoint: Record<string, unknown>,
    point1: Record<string, unknown>,
    point2: Record<string, unknown>,
    node: NodeLike,
    toNode: NodeLike
  ) => void
  declare removeControls: () => void
  declare hideControls: () => void
  declare showControls: () => void
  declare updataAassociativeLine: (
    startPoint: Record<string, unknown>,
    endPoint: Record<string, unknown>,
    point1: Record<string, unknown>,
    point2: Record<string, unknown>,
    activeLine: Record<string, unknown>
  ) => void
  declare getText: (node: NodeLike, toNode: NodeLike) => string | undefined
  declare createText: (data: Record<string, unknown>) => SVGLike
  declare styleText: (textNode: SVGLike, node: NodeLike, toNode: NodeLike) => void
  declare showEditTextBox: (g: SVGLike) => void
  declare setIsShowTextEdit: (val: boolean) => void
  declare removeTextEditEl: () => void
  declare hideEditTextBox: () => void
  declare onControlPointMouseup: (e: MouseEvent) => void
  declare updateTextPos: (path: SVGLike, text: SVGLike) => void
  declare renderText: (
    str: string | undefined,
    path: SVGLike,
    text: SVGLike,
    node: NodeLike,
    toNode: NodeLike
  ) => void

  declare onScale: () => void
  constructor(opt: Record<string, unknown> = {}) {
    this.mindMap = opt.mindMap as MindMapInstance
    this.associativeLineDraw = this.mindMap.associativeLineDraw as unknown as SVGLike
    // 本次不要重新渲染连线
    this.isNotRenderAllLines = false
    // 当前所有连接线
    this.lineList = []
    // 当前激活的连接线
    this.activeLine = null
    // 当前正在创建连接线
    this.isCreatingLine = false
    this.creatingStartNode = null
    this.creatingLine = null
    this.overlapNode = null
    // 是否有节点正在被拖拽
    this.isNodeDragging = false
    // 控制点
    this.controlLine1 = null
    this.controlLine2 = null
    this.controlPoint1 = null
    this.controlPoint2 = null
    this.controlPointDiameter = 10
    this.isControlPointMousedown = false
    this.mousedownControlPointKey = ''
    this.controlPointMousemoveState = {
      pos: null,
      startPoint: null,
      endPoint: null,
      targetIndex: ''
    }
    // 节流一下，不然很卡
    this.checkOverlapNode = throttle(this.checkOverlapNode.bind(this), 100)
    // 控制点相关方法
    Object.keys(associativeLineControlsMethods).forEach(item => {
      ;(this as unknown as Record<string, Function>)[item] = (
        associativeLineControlsMethods as Record<string, Function>
      )[item].bind(this)
    })
    // 关联线文字相关方法
    this.showTextEdit = false
    Object.keys(associativeLineTextMethods).forEach(item => {
      ;(this as unknown as Record<string, Function>)[item] = (
        associativeLineTextMethods as Record<string, Function>
      )[item].bind(this)
    })
    this.mindMap.addEditNodeClass(ASSOCIATIVE_LINE_TEXT_EDIT_WRAP)
    this.bindEvent()
  }

  // 监听事件
  bindEvent() {
    this.renderAllLines = this.renderAllLines.bind(this)
    this.onDrawClick = this.onDrawClick.bind(this)
    this.onNodeClick = this.onNodeClick.bind(this)
    this.removeLine = this.removeLine.bind(this)
    this.addLine = this.addLine.bind(this)
    this.onMousemove = this.onMousemove.bind(this)
    this.onNodeDragging = this.onNodeDragging.bind(this)
    this.onNodeDragend = this.onNodeDragend.bind(this)
    this.onControlPointMouseup = this.onControlPointMouseup.bind(this)
    this.onBeforeDestroy = this.onBeforeDestroy.bind(this)

    this.mindMap.on('node_tree_render_end', this.renderAllLines)
    this.mindMap.on('data_change', this.renderAllLines)
    this.mindMap.on('draw_click', this.onDrawClick)
    this.mindMap.on('node_click', this.onNodeClick)
    this.mindMap.on('contextmenu', this.onDrawClick)
    this.mindMap.keyCommand.addShortcut('Del|Backspace', this.removeLine)
    this.mindMap.command.add('ADD_ASSOCIATIVE_LINE', this.addLine)
    this.mindMap.on('mousemove', this.onMousemove)
    this.mindMap.on('node_dragging', this.onNodeDragging)
    this.mindMap.on('node_dragend', this.onNodeDragend)
    this.mindMap.on('mouseup', this.onControlPointMouseup)
    this.mindMap.on('scale', this.onScale)
    this.mindMap.on('beforeDestroy', this.onBeforeDestroy)
  }

  unBindEvent() {
    this.mindMap.off('node_tree_render_end', this.renderAllLines)
    this.mindMap.off('data_change', this.renderAllLines)
    this.mindMap.off('draw_click', this.onDrawClick)
    this.mindMap.off('node_click', this.onNodeClick)
    this.mindMap.off('contextmenu', this.onDrawClick)
    this.mindMap.keyCommand.removeShortcut('Del|Backspace', this.removeLine)
    this.mindMap.command.remove('ADD_ASSOCIATIVE_LINE', this.addLine)
    this.mindMap.off('mousemove', this.onMousemove)
    this.mindMap.off('node_dragging', this.onNodeDragging)
    this.mindMap.off('node_dragend', this.onNodeDragend)
    this.mindMap.off('mouseup', this.onControlPointMouseup)
    this.mindMap.off('scale', this.onScale)
    this.mindMap.off('beforeDestroy', this.onBeforeDestroy)
  }

  getStyleConfig(node: NodeLike, toNode?: NodeLike) {
    let lineStyle: Record<string, unknown> = {}
    if (toNode) {
      const associativeLineStyle = node.getData('associativeLineStyle') || {}
      lineStyle = ((associativeLineStyle as Record<string, unknown>)[
        toNode.getData('uid') as string
      ] || {}) as Record<string, unknown>
    }
    const res: Record<string, unknown> = {}
    styleProps.forEach(prop => {
      if (typeof lineStyle[prop] !== 'undefined') {
        res[prop] = lineStyle[prop]
      } else {
        res[prop] = node.getStyle(prop)
      }
    })
    return res
  }

  onBeforeDestroy() {
    this.hideEditTextBox()
    this.removeTextEditEl()
  }

  onDrawClick() {
    if (this.isCreatingLine) {
      this.cancelCreateLine()
    }
    if (!this.isControlPointMousedown) {
      this.clearActiveLine()
      this.renderAllLines()
    }
  }

  onNodeClick(node: NodeLike) {
    if (this.isCreatingLine) {
      this.completeCreateLine(node)
    } else {
      this.clearActiveLine()
      this.renderAllLines()
    }
  }

  createMarker(callback: (p: SVGLike) => void = () => {}) {
    return this.associativeLineDraw.marker(20, 20, (add: SVGAddLike) => {
      add.ref(12, 5)
      add.size(10, 10)
      add.attr({ orient: 'auto-start-reverse' })
      callback(add.path('M0,0 L2,5 L0,10 L10,5 Z'))
    })
  }

  updateAllLinesPos(
    node: NodeLike,
    toNode: NodeLike,
    associativeLinePoint: Record<string, unknown>
  ) {
    associativeLinePoint = associativeLinePoint || {}
    let [startPoint, endPoint] = computeNodePoints(node, toNode)
    let nodeRange = 0
    let nodeDir = ''
    let toNodeRange = 0
    let toNodeDir = ''
    if (associativeLinePoint.startPoint) {
      nodeRange =
        ((associativeLinePoint.startPoint as Record<string, unknown>).range as number) || 0
      nodeDir =
        ((associativeLinePoint.startPoint as Record<string, unknown>).dir as string) || 'right'
      startPoint = getNodePoint(node, nodeDir, nodeRange)
    }
    if (associativeLinePoint.endPoint) {
      toNodeRange =
        ((associativeLinePoint.endPoint as Record<string, unknown>).range as number) || 0
      toNodeDir =
        ((associativeLinePoint.endPoint as Record<string, unknown>).dir as string) || 'right'
      endPoint = getNodePoint(toNode, toNodeDir, toNodeRange)
    }
    return [startPoint, endPoint]
  }

  renderAllLines() {
    if (this.isNotRenderAllLines) {
      this.isNotRenderAllLines = false
      return
    }
    this.removeAllLines()
    this.removeControls()
    this.clearActiveLine()
    let tree = this.mindMap.renderer.root as NodeLike | null
    if (!tree) return
    let idToNode = new Map<string, NodeLike>()
    let nodeToIds = new Map<NodeLike, Array<string>>()
    walk(
      tree,
      null,
      (cur: NodeLike) => {
        if (!cur) return
        let data = cur.getData<Record<string, unknown>>()
        if (
          data.associativeLineTargets &&
          (data.associativeLineTargets as Array<string>).length > 0
        ) {
          nodeToIds.set(cur, data.associativeLineTargets as Array<string>)
        }
        if (data.uid) {
          idToNode.set(data.uid as string, cur)
        }
      },
      () => {},
      true,
      0
    )
    nodeToIds.forEach((ids: Array<string>, node: NodeLike) => {
      ids.forEach((uid: string, index: number) => {
        let toNode = idToNode.get(uid)
        if (!node || !toNode) return
        const associativeLinePoint = (node.getData<Array<Record<string, unknown>>>(
          'associativeLinePoint'
        ) || [])[index]
        const [startPoint, endPoint] = this.updateAllLinesPos(node, toNode, associativeLinePoint)
        this.drawLine(startPoint, endPoint, node, toNode)
      })
    })
  }

  drawLine(
    startPoint: Record<string, unknown>,
    endPoint: Record<string, unknown>,
    node: NodeLike,
    toNode: NodeLike
  ) {
    let {
      associativeLineWidth,
      associativeLineColor,
      associativeLineActiveWidth,
      associativeLineDasharray
    } = this.getStyleConfig(node, toNode) as Record<string, unknown>
    let markerPath: SVGLike | null = null
    const marker = this.createMarker((p: SVGLike) => {
      markerPath = p
    })
    ;(markerPath as SVGLike)
      .stroke({ color: associativeLineColor })
      .fill({ color: associativeLineColor })
    let { path: pathStr, controlPoints } = getNodeLinePath(startPoint, endPoint, node, toNode)
    let path = this.associativeLineDraw.path() as SVGLike
    path
      .stroke({
        width: associativeLineWidth,
        color: associativeLineColor,
        dasharray: associativeLineDasharray || '6,4'
      })
      .fill({ color: 'none' })
    path.plot(pathStr as string)
    path.marker('end', marker as unknown as SVGLike)
    let clickPath = this.associativeLineDraw.path() as SVGLike
    clickPath
      .stroke({ width: associativeLineActiveWidth, color: 'transparent' })
      .fill({ color: 'none' })
    clickPath.plot(pathStr as string)
    let text = this.createText({
      path,
      clickPath,
      markerPath,
      node,
      toNode,
      startPoint,
      endPoint,
      controlPoints
    })
    clickPath.click((e: MouseEvent) => {
      e.stopPropagation()
      this.setActiveLine({
        path,
        clickPath,
        markerPath,
        text,
        node,
        toNode,
        startPoint,
        endPoint,
        controlPoints
      })
    })
    clickPath.dblclick(() => {
      if (!this.activeLine) return
      this.showEditTextBox(text)
    })
    this.renderText(this.getText(node, toNode), path, text, node, toNode)
    this.lineList.push([path, clickPath, text, node, toNode])
  }

  updateActiveLineStyle() {
    if (!this.activeLine) return
    this.isNotRenderAllLines = true
    const [path, clickPath, text, node, toNode] = this.activeLine
    const {
      associativeLineWidth,
      associativeLineColor,
      associativeLineDasharray,
      associativeLineActiveWidth,
      associativeLineActiveColor,
      associativeLineTextColor,
      associativeLineTextFontFamily,
      associativeLineTextFontSize
    } = this.getStyleConfig(node, toNode) as Record<string, unknown>
    path
      .stroke({
        width: associativeLineWidth,
        color: associativeLineColor,
        dasharray: associativeLineDasharray || '6,4'
      })
      .fill({ color: 'none' })
    clickPath
      .stroke({ width: associativeLineActiveWidth, color: associativeLineActiveColor })
      .fill({ color: 'none' })
    this.activeLine[5] = this.activeLine[5] || ({} as SVGLike)
    ;(this.activeLine[5] as SVGLike)
      .stroke({ color: associativeLineColor })
      .fill({ color: associativeLineColor })
    text.find('text').forEach((textNode: SVGLike) => {
      textNode.fill({ color: associativeLineTextColor }).css({
        'font-family': associativeLineTextFontFamily,
        'font-size': (associativeLineTextFontSize as number) + 'px'
      })
    })
    if (this.controlLine1) this.controlLine1.stroke({ color: associativeLineActiveColor })
    if (this.controlLine2) this.controlLine2.stroke({ color: associativeLineActiveColor })
    if (this.controlPoint1) this.controlPoint1.stroke({ color: associativeLineActiveColor })
    if (this.controlPoint2) this.controlPoint2.stroke({ color: associativeLineActiveColor })
    this.updateTextPos(path, text)
  }

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
  }: Record<string, unknown>) {
    let { associativeLineActiveColor } = this.getStyleConfig(
      node as NodeLike,
      toNode as NodeLike
    ) as Record<string, unknown>
    this.mindMap.execCommand('CLEAR_ACTIVE_NODE')
    this.clearActiveLine()
    this.activeLine = [
      path as SVGLike,
      clickPath as SVGLike,
      text as SVGLike,
      node as NodeLike,
      toNode as NodeLike,
      markerPath as SVGLike
    ]
    ;(clickPath as SVGLike).stroke({ color: associativeLineActiveColor })
    if (!this.getText(node as NodeLike, toNode as NodeLike)) {
      this.renderText(
        this.mindMap.opt.defaultAssociativeLineText as string | undefined,
        path as SVGLike,
        text as SVGLike,
        node as NodeLike,
        toNode as NodeLike
      )
    }
    this.renderControls(
      startPoint as Record<string, unknown>,
      endPoint as Record<string, unknown>,
      (controlPoints as Array<Record<string, unknown>>)[0],
      (controlPoints as Array<Record<string, unknown>>)[1],
      node as NodeLike,
      toNode as NodeLike
    )
    this.mindMap.emit('associative_line_click', path, clickPath, node, toNode)
    this.front()
  }

  removeAllLines() {
    this.lineList.forEach(line => {
      line[0].remove()
      line[1].remove()
      line[2].remove()
    })
    this.lineList = []
  }

  createLineFromActiveNode() {
    if (this.mindMap.renderer.activeNodeList.length <= 0) return
    let node = this.mindMap.renderer.activeNodeList[0]
    this.createLine(node as NodeLike)
  }

  createLine(fromNode: NodeLike) {
    let { associativeLineWidth, associativeLineColor, associativeLineDasharray } =
      this.getStyleConfig(fromNode) as Record<string, unknown>
    if (this.isCreatingLine || !fromNode) return
    this.front()
    this.isCreatingLine = true
    this.creatingStartNode = fromNode
    this.creatingLine = this.associativeLineDraw.path() as SVGLike
    this.creatingLine
      .stroke({
        width: associativeLineWidth,
        color: associativeLineColor,
        dasharray: associativeLineDasharray || '6,4'
      })
      .fill({ color: 'none' })
    let markerPath: SVGLike | null = null
    const marker = this.createMarker((p: SVGLike) => {
      markerPath = p
    })
    ;(markerPath as SVGLike)
      .stroke({ color: associativeLineColor })
      .fill({ color: associativeLineColor })
    this.creatingLine.marker('end', marker as unknown as SVGLike)
  }

  cancelCreateLine() {
    this.isCreatingLine = false
    this.creatingStartNode = null
    ;(this.creatingLine as SVGLike).remove()
    this.creatingLine = null
    this.overlapNode = null
    this.back()
  }

  onMousemove(e: MouseEvent) {
    this.onControlPointMousemove(e)
    this.updateCreatingLine(e)
  }

  updateCreatingLine(e: MouseEvent) {
    if (!this.isCreatingLine) return
    let { x, y } = this.getTransformedEventPos(e)
    let startPoint = getNodePoint(this.creatingStartNode as NodeLike)
    let offsetX = x > startPoint.x ? -10 : 10
    let pathStr = cubicBezierPath(startPoint.x, startPoint.y, x + offsetX, y)
    ;(this.creatingLine as SVGLike).plot(pathStr)
    this.checkOverlapNode(x, y)
  }

  getTransformedEventPos(e: MouseEvent) {
    let { x, y } = this.mindMap.toPos(e.clientX, e.clientY)
    let { scaleX, scaleY, translateX, translateY } = this.mindMap.draw.transform() as Record<
      string,
      number
    >
    return { x: (x - translateX) / scaleX, y: (y - translateY) / scaleY }
  }

  getNodePos(node: Record<string, number>) {
    const { scaleX, scaleY, translateX, translateY } = this.mindMap.draw.transform() as Record<
      string,
      number
    >
    const { left, top, width, height } = node
    let translateLeft = left * scaleX + translateX
    let translateTop = top * scaleY + translateY
    return { left, top, translateLeft, translateTop, width, height }
  }

  checkOverlapNode(x: number, y: number) {
    this.overlapNode = null
    bfsWalk(this.mindMap.renderer.root, (node: NodeLike) => {
      if (node.getData('isActive')) {
        this.mindMap.execCommand('SET_NODE_ACTIVE', node, false)
      }
      if (node.uid === (this.creatingStartNode as NodeLike).uid || this.overlapNode) {
        return
      }
      let { left, top, width, height } = node as Record<string, number>
      let right = left + width
      let bottom = top + height
      if (x >= left && x <= right && y >= top && y <= bottom) {
        this.overlapNode = node
      }
    })
    if (this.overlapNode && !this.overlapNode.getData('isActive')) {
      this.mindMap.execCommand('SET_NODE_ACTIVE', this.overlapNode, true)
    }
  }

  completeCreateLine(node: NodeLike) {
    if ((this.creatingStartNode as NodeLike).uid === node.uid) return
    const { beforeAssociativeLineConnection } = this.mindMap.opt
    let stop = false
    if (typeof beforeAssociativeLineConnection === 'function') {
      stop = (beforeAssociativeLineConnection as (node: NodeLike) => boolean)(node)
    }
    if (stop) return
    this.addLine(this.creatingStartNode as NodeLike, node)
    if (this.overlapNode && this.overlapNode.getData('isActive')) {
      this.mindMap.execCommand('SET_NODE_ACTIVE', this.overlapNode, false)
    }
    this.cancelCreateLine()
  }

  addLine(fromNode: NodeLike, toNode: NodeLike) {
    if (!fromNode || !toNode) return
    let uid = fromNode.getData<string>('uid') || ''
    if (!uid) {
      uid = uuid()
      this.mindMap.execCommand('SET_NODE_DATA', toNode, { uid })
    }
    let list = fromNode.getData<Array<string>>('associativeLineTargets') || []
    const sameLine = list.some(item => item === uid)
    if (sameLine) return
    list.push(uid)
    let [startPoint, endPoint] = computeNodePoints(fromNode, toNode)
    let controlPoints = computeCubicBezierPathPoints(
      startPoint.x,
      startPoint.y,
      endPoint.x,
      endPoint.y
    )
    const { associativeLineInitPointsPosition } = this.mindMap.opt
    if (associativeLineInitPointsPosition) {
      const pos = associativeLineInitPointsPosition as Record<string, unknown>
      const from = pos.from as string | undefined
      const toDir = pos.to as string | undefined
      if (from) startPoint.dir = from
      if (toDir) endPoint.dir = toDir
    }
    let offsetList =
      fromNode.getData<Array<Array<Record<string, number>>>>(
        'associativeLineTargetControlOffsets'
      ) || []
    offsetList[list.length - 1] = [
      { x: controlPoints[0].x - startPoint.x, y: controlPoints[0].y - startPoint.y },
      { x: controlPoints[1].x - endPoint.x, y: controlPoints[1].y - endPoint.y }
    ]
    let associativeLinePoint =
      fromNode.getData<Array<Record<string, unknown>>>('associativeLinePoint') || []
    associativeLinePoint[list.length - 1] = { startPoint, endPoint }
    this.mindMap.execCommand('SET_NODE_DATA', fromNode, {
      associativeLineTargets: list,
      associativeLineTargetControlOffsets: offsetList,
      associativeLinePoint
    })
  }

  removeLine() {
    if (!this.activeLine) return
    let [, , , node, toNode] = this.activeLine
    this.removeControls()
    let {
      associativeLineTargets,
      associativeLinePoint,
      associativeLineTargetControlOffsets,
      associativeLineText,
      associativeLineStyle
    } = node.getData<Record<string, unknown>>()
    associativeLinePoint = associativeLinePoint || []
    let targetIndex = getAssociativeLineTargetIndex(node, toNode)
    let newAssociativeLineText: Record<string, unknown> = {}
    let at = associativeLineText as Record<string, unknown> | undefined
    if (at) {
      Object.keys(at).forEach(item => {
        if (item !== toNode.getData('uid')) newAssociativeLineText[item] = at[item]
      })
    }
    let newAssociativeLineStyle: Record<string, unknown> = {}
    let as = associativeLineStyle as Record<string, unknown> | undefined
    if (as) {
      Object.keys(as).forEach(item => {
        if (item !== toNode.getData('uid')) newAssociativeLineStyle[item] = as[item]
      })
    }
    this.mindMap.execCommand('SET_NODE_DATA', node, {
      associativeLineTargets: (associativeLineTargets as Array<unknown>).filter(
        (_: unknown, index: number) => index !== targetIndex
      ),
      associativeLinePoint: (associativeLinePoint as Array<unknown>).filter(
        (_: unknown, index: number) => index !== targetIndex
      ),
      associativeLineTargetControlOffsets: associativeLineTargetControlOffsets
        ? (associativeLineTargetControlOffsets as Array<unknown>).filter(
            (_: unknown, index: number) => index !== targetIndex
          )
        : [],
      associativeLineText: newAssociativeLineText,
      associativeLineStyle: newAssociativeLineStyle
    })
  }

  clearActiveLine() {
    if (this.activeLine) {
      let [, clickPath, text, node, toNode] = this.activeLine
      clickPath.stroke({ color: 'transparent' })
      this.hideEditTextBox()
      if (!this.getText(node, toNode)) text.clear()
      this.activeLine = null
      this.removeControls()
      this.back()
      this.mindMap.emit('associative_line_deactivate')
    }
  }

  onNodeDragging() {
    if (this.isNodeDragging) return
    this.isNodeDragging = true
    this.lineList.forEach(line => {
      line[0].hide()
      line[1].hide()
      line[2].hide()
    })
    this.hideControls()
  }

  onNodeDragend() {
    if (!this.isNodeDragging) return
    this.lineList.forEach(line => {
      line[0].show()
      line[1].show()
      line[2].show()
    })
    this.showControls()
    this.isNodeDragging = false
  }

  front() {
    if (this.mindMap.opt.associativeLineIsAlwaysAboveNode) return
    this.associativeLineDraw.front()
  }

  back() {
    if (this.mindMap.opt.associativeLineIsAlwaysAboveNode) return
    this.associativeLineDraw.back()
    this.associativeLineDraw.forward()
  }

  beforePluginRemove() {
    this.mindMap.deleteEditNodeClass(ASSOCIATIVE_LINE_TEXT_EDIT_WRAP)
    this.unBindEvent()
  }

  beforePluginDestroy() {
    this.mindMap.deleteEditNodeClass(ASSOCIATIVE_LINE_TEXT_EDIT_WRAP)
    this.unBindEvent()
  }
}

AssociativeLine.instanceName = 'associativeLine'

export default AssociativeLine
