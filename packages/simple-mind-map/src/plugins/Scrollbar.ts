// @ts-nocheck — vendored engine source
import { throttle } from '../utils/index'
import { CONSTANTS } from '../constants/constant'

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
  elRect: Record<string, unknown> & { left: number; top: number }
}

interface ScrollbarData {
  vertical: { top: number; height: number }
  horizontal: { left: number; width: number }
}
interface CancelableHandler {
  (...args: unknown[]): void
  cancel(): void
}


// 滚动条插件
class Scrollbar {
  static instanceName: string = 'scrollbar'

  private mindMap: MindMapInstance
  private scrollbarWrapSize: { width: number; height: number }
  private chartHeight: number
  private chartWidth: number
  private currentScrollType: string
  private isMousedown: boolean
  private mousedownPos: { x: number; y: number }
  private mousedownScrollbarPos: number
  private scheduledUpdateScrollbar!: CancelableHandler

  //  构造函数
  constructor(opt: { mindMap: MindMapInstance }) {
    this.mindMap = opt.mindMap
    this.scrollbarWrapSize = {
      width: 0,
      height: 0
    }
    this.chartHeight = 0
    this.chartWidth = 0
    this.currentScrollType = ''
    this.isMousedown = false
    this.mousedownPos = { x: 0, y: 0 }
    this.mousedownScrollbarPos = 0
    this.reset()
    this.bindEvent()
  }

  // 复位数据
  reset(): void {
    this.currentScrollType = ''
    this.isMousedown = false
    this.mousedownPos = {
      x: 0,
      y: 0
    }
    this.mousedownScrollbarPos = 0
  }

  // 绑定事件
  bindEvent(): void {
    this.onMousemove = this.onMousemove.bind(this)
    this.onMouseup = this.onMouseup.bind(this)
    this.scheduledUpdateScrollbar = throttle(this.updateScrollbar.bind(this), 16, this)
    this.mindMap.on('mousemove', this.onMousemove)
    this.mindMap.on('mouseup', this.onMouseup)
    this.mindMap.on('node_tree_render_end', this.scheduledUpdateScrollbar)
    this.mindMap.on('view_data_change', this.scheduledUpdateScrollbar)
    this.mindMap.on('resize', this.scheduledUpdateScrollbar)
  }

  // 解绑事件
  unBindEvent(): void {
    this.scheduledUpdateScrollbar.cancel()
    this.mindMap.off('mousemove', this.onMousemove)
    this.mindMap.off('mouseup', this.onMouseup)
    this.mindMap.off('node_tree_render_end', this.scheduledUpdateScrollbar)
    this.mindMap.off('view_data_change', this.scheduledUpdateScrollbar)
    this.mindMap.off('resize', this.scheduledUpdateScrollbar)
  }

  // 渲染后、数据改变需要更新滚动条
  updateScrollbar(): void {
    if (this.isMousedown) return
    const res = this.calculationScrollbar()
    this.emitEvent(res)
  }

  // 发送滚动条改变事件
  emitEvent(data: ScrollbarData): void {
    this.mindMap.emit('scrollbar_change', data)
  }

  // 设置滚动条容器的大小
  setScrollBarWrapSize(width: number, height: number): void {
    this.scrollbarWrapSize.width = width
    this.scrollbarWrapSize.height = height
  }

  // 计算滚动条大小和位置
  calculationScrollbar(): ScrollbarData {
    const rect = this.mindMap.draw.rbox() as Record<string, unknown> & {
      x: number
      y: number
      width: number
      height: number
    }
    const elRect = this.mindMap.elRect
    rect.x -= elRect.left
    rect.y -= elRect.top

    // 垂直：自由视窗下滚动范围 = (内容+padding) ∪ 当前视窗[0, canvasHeight]，
    // 使平移到内容外的空白区域时 thumb 仍能反映视窗在自由画布中的真实位置（不再撞边卡死）。
    // 内容仍在视窗内的常规情形下，range 与旧的 (内容+padding) 完全一致，行为不变。
    const canvasHeight = this.mindMap.height
    const paddingY = canvasHeight / 2
    const contentTop = rect.y - paddingY
    const contentBottom = rect.y + rect.height + paddingY
    const rangeTop = Math.min(contentTop, 0)
    const rangeBottom = Math.max(contentBottom, canvasHeight)
    const chartHeight = rangeBottom - rangeTop
    this.chartHeight = chartHeight
    const height = Math.min((canvasHeight / chartHeight) * 100, 100)
    let top = ((0 - rangeTop) / chartHeight) * 100
    if (top < 0) {
      top = 0
    }
    if (top > 100 - height) {
      top = 100 - height
    }

    // 水平：同理，range = (内容+padding) ∪ 当前视窗[0, canvasWidth]
    const canvasWidth = this.mindMap.width
    const paddingX = canvasWidth / 2
    const contentLeft = rect.x - paddingX
    const contentRight = rect.x + rect.width + paddingX
    const rangeLeft = Math.min(contentLeft, 0)
    const rangeRight = Math.max(contentRight, canvasWidth)
    const chartWidth = rangeRight - rangeLeft
    this.chartWidth = chartWidth
    const width = Math.min((canvasWidth / chartWidth) * 100, 100)
    let left = ((0 - rangeLeft) / chartWidth) * 100
    if (left < 0) {
      left = 0
    }
    if (left > 100 - width) {
      left = 100 - width
    }

    const res: ScrollbarData = {
      vertical: {
        top,
        height
      },
      horizontal: {
        left,
        width
      }
    }

    return res
  }

  // 滚动条鼠标按下事件处理函数
  onMousedown(e: MouseEvent, type: string): void {
    e.preventDefault()
    e.stopPropagation()
    this.currentScrollType = type
    this.isMousedown = true
    this.mousedownPos = {
      x: e.clientX,
      y: e.clientY
    }
    const styles = window.getComputedStyle(e.target as Element)
    if (type === CONSTANTS.SCROLL_BAR_DIR.VERTICAL) {
      this.mousedownScrollbarPos = Number.parseFloat(styles.top)
    } else {
      this.mousedownScrollbarPos = Number.parseFloat(styles.left)
    }
  }

  // 鼠标移动事件处理函数
  onMousemove(e: MouseEvent): void {
    if (!this.isMousedown) {
      return
    }
    e.preventDefault()
    e.stopPropagation()
    if (this.currentScrollType === CONSTANTS.SCROLL_BAR_DIR.VERTICAL) {
      const oy = e.clientY - this.mousedownPos.y + this.mousedownScrollbarPos
      this.updateMindMapView(CONSTANTS.SCROLL_BAR_DIR.VERTICAL, oy)
    } else {
      const ox = e.clientX - this.mousedownPos.x + this.mousedownScrollbarPos
      this.updateMindMapView(CONSTANTS.SCROLL_BAR_DIR.HORIZONTAL, ox)
    }
  }

  // 鼠标松开事件处理函数
  onMouseup(): void {
    this.isMousedown = false
    this.reset()
  }

  // 更新视图
  updateMindMapView(type: string, offset: number): void {
    const scrollbarData = this.calculationScrollbar()
    const t = this.mindMap.draw.transform() as Record<string, unknown> & {
      scaleY: number
      scaleX: number
    }
    const drawRect = this.mindMap.draw.rbox() as Record<string, unknown> & { x: number; y: number }
    const renderer = this.mindMap.renderer as Record<string, unknown> & {
      root: Record<string, unknown> & {
        group: Record<string, unknown> & { rbox(): Record<string, unknown> }
      }
      layout: Record<string, unknown> & {
        getRootCenterOffset: (
          w: number,
          h: number
        ) => Record<string, unknown> & { x: number; y: number }
      }
    }
    const rootRect = renderer.root.group.rbox() as Record<string, unknown> & {
      x: number
      y: number
      width: number
      height: number
    }
    const rootCenterOffset = renderer.layout.getRootCenterOffset(rootRect.width, rootRect.height)
    if (type === CONSTANTS.SCROLL_BAR_DIR.VERTICAL) {
      let oy = offset
      if (oy <= 0) {
        oy = 0
      }
      const max = ((100 - scrollbarData.vertical.height) / 100) * this.scrollbarWrapSize.height
      if (oy >= max) {
        oy = max
      }
      const oyPercentage = (oy / this.scrollbarWrapSize.height) * 100
      const oyPx = (-oyPercentage / 100) * this.chartHeight
      const yOffset = rootRect.y - drawRect.y
      const paddingY = this.mindMap.height / 2
      const chartTop =
        oyPx +
        yOffset -
        paddingY * t.scaleY +
        paddingY -
        rootCenterOffset.y * t.scaleY +
        ((this.mindMap.height - this.mindMap.initHeight) / 2) * t.scaleY
      this.mindMap.view.translateYTo(chartTop)
      this.emitEvent({
        horizontal: scrollbarData.horizontal,
        vertical: {
          top: oyPercentage,
          height: scrollbarData.vertical.height
        }
      })
    } else {
      let ox = offset
      if (ox <= 0) {
        ox = 0
      }
      const max = ((100 - scrollbarData.horizontal.width) / 100) * this.scrollbarWrapSize.width
      if (ox >= max) {
        ox = max
      }
      const oxPercentage = (ox / this.scrollbarWrapSize.width) * 100
      const oxPx = (-oxPercentage / 100) * this.chartWidth
      const xOffset = rootRect.x - drawRect.x
      const paddingX = this.mindMap.width / 2
      const chartLeft =
        oxPx +
        xOffset -
        paddingX * t.scaleX +
        paddingX -
        rootCenterOffset.x * t.scaleX +
        ((this.mindMap.width - this.mindMap.initWidth) / 2) * t.scaleX
      this.mindMap.view.translateXTo(chartLeft)
      this.emitEvent({
        vertical: scrollbarData.vertical,
        horizontal: {
          left: oxPercentage,
          width: scrollbarData.horizontal.width
        }
      })
    }
  }

  // 滚动条的点击事件
  onClick(e: MouseEvent, type: string): void {
    let offset = 0
    if (type === CONSTANTS.SCROLL_BAR_DIR.VERTICAL) {
      offset = e.clientY - (e.currentTarget as Element).getBoundingClientRect().top
    } else {
      offset = e.clientX - (e.currentTarget as Element).getBoundingClientRect().left
    }
    this.updateMindMapView(type, offset)
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

export default Scrollbar