import { checkIsNodeStyleDataKey } from '../utils/index'

interface MindMapInstance {
  on(event: string, handler: Function): void
  off(event: string, handler: Function): void
  emit(event: string, ...args: unknown[]): void
  opt: Record<string, unknown> & {
    readonly: boolean
    onlyPainterNodeCustomStyles: boolean
  }
  renderer: Record<string, unknown> & {
    activeNodeList: Record<string, unknown>[]
    _handleRemoveCustomStyles(data: Record<string, unknown>): void
  }
}

interface PainterNode {
  uid: string | number
  getData(key?: string): unknown
  effectiveStyles: Record<string, unknown>
  setStyles(style: Record<string, unknown>): void
}

// 格式刷插件
class Painter {
  static instanceName: string = 'painter'

  private mindMap: MindMapInstance
  private isInPainter: boolean
  private painterNode: PainterNode | null

  constructor({ mindMap }: { mindMap: MindMapInstance }) {
    this.mindMap = mindMap
    this.isInPainter = false
    this.painterNode = null
    this.bindEvent()
  }

  bindEvent(): void {
    this.painterOneNode = this.painterOneNode.bind(this)
    this.onEndPainter = this.onEndPainter.bind(this)
    this.mindMap.on('node_click', this.painterOneNode)
    this.mindMap.on('draw_click', this.onEndPainter)
  }

  unBindEvent(): void {
    this.mindMap.off('node_click', this.painterOneNode)
    this.mindMap.off('draw_click', this.onEndPainter)
  }

  // 开始格式刷
  startPainter(): void {
    if (this.mindMap.opt.readonly) return
    let activeNodeList = this.mindMap.renderer.activeNodeList
    if (activeNodeList.length <= 0) return
    this.painterNode = activeNodeList[0] as unknown as PainterNode
    this.isInPainter = true
    this.mindMap.emit('painter_start')
  }

  // 结束格式刷
  endPainter(): void {
    this.painterNode = null
    this.isInPainter = false
  }

  onEndPainter(): void {
    if (!this.isInPainter) return
    this.endPainter()
    this.mindMap.emit('painter_end')
  }

  // 格式刷某个节点
  painterOneNode(node: PainterNode): void {
    if (
      !node ||
      !this.isInPainter ||
      !this.painterNode ||
      !node ||
      node.uid === this.painterNode.uid
    )
      return
    let style: Record<string, unknown> = {}
    if (!this.mindMap.opt.onlyPainterNodeCustomStyles) {
      style = {
        ...this.painterNode.effectiveStyles
      }
    }
    const painterNodeData = this.painterNode.getData() as Record<string, unknown>
    Object.keys(painterNodeData).forEach(key => {
      if (checkIsNodeStyleDataKey(key)) {
        style[key] = painterNodeData[key]
      }
    })
    this.mindMap.renderer._handleRemoveCustomStyles(node.getData() as Record<string, unknown>)
    node.setStyles(style)
  }

  // 插件被移除前做的事情
  beforePluginRemove(): void {
    this.unBindEvent()
  }

  // 插件被卸载前做的事情
  beforePluginDestroy(): void {
    this.unBindEvent()
  }
}

export default Painter
