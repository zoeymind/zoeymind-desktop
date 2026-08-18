import { Text, G } from '@svgdotjs/svg.js'
import { degToRad, camelCaseToHyphen } from '../utils'
import merge from 'deepmerge'

interface MindMapInstance {
  on(event: string, handler: Function): void
  off(event: string, handler: Function): void
  emit(event: string, ...args: unknown[]): void
  draw: Record<string, unknown> & { insertBefore(target: unknown): void }
  svg: Record<string, unknown> & { add(child: unknown): void }
  opt: Record<string, unknown> & { watermarkConfig: Record<string, unknown> }
  width: number
  height: number
}

// 水印插件
class Watermark {
  static instanceName: string = 'watermark'

  private mindMap: MindMapInstance
  private lineSpacing: number
  private textSpacing: number
  private angle: number
  private text: string
  private textStyle: Record<string, unknown>
  private watermarkDraw:
    | (Record<string, unknown> & {
        insertBefore(target: unknown): void
        remove(): void
        clear(): void
        add(child: unknown): void
      })
    | null
  private isInExport: boolean
  private maxLong: number

  constructor(opt: Record<string, unknown> = {}) {
    this.mindMap = opt.mindMap as MindMapInstance
    this.lineSpacing = 0
    this.textSpacing = 0
    this.angle = 0
    this.text = ''
    this.textStyle = {}
    this.watermarkDraw = null
    this.isInExport = false
    this.maxLong = this.getMaxLong()
    this.updateWatermark(this.mindMap.opt.watermarkConfig || {})
    this.bindEvent()
  }

  getMaxLong(): number {
    return Math.sqrt(Math.pow(this.mindMap.width, 2) + Math.pow(this.mindMap.height, 2))
  }

  bindEvent(): void {
    this.onResize = this.onResize.bind(this)
    this.mindMap.on('resize', this.onResize)
  }

  unBindEvent(): void {
    this.mindMap.off('resize', this.onResize)
  }

  onResize(): void {
    this.maxLong = this.getMaxLong()
    this.draw()
  }

  // 创建水印容器
  createContainer(): void {
    const container = new G() as unknown as Record<string, unknown> & {
      css(s: Record<string, string>): void
      addClass(c: string): void
    }
    container.css({ 'pointer-events': 'none', 'user-select': 'none' })
    container.addClass('smm-water-mark-container')
    this.watermarkDraw = container as unknown as Record<string, unknown> & {
      insertBefore(target: unknown): void
      remove(): void
      clear(): void
      add(child: unknown): void
    }
    this.updateLayer()
  }

  // 更新水印容器层级
  updateLayer(): void {
    if (!this.watermarkDraw) return
    const { belowNode } = this.mindMap.opt.watermarkConfig
    if (belowNode) {
      this.watermarkDraw.insertBefore(this.mindMap.draw)
    } else {
      this.mindMap.svg.add(this.watermarkDraw)
    }
  }

  // 删除水印容器
  removeContainer(): void {
    if (!this.watermarkDraw) {
      return
    }
    ;(this.watermarkDraw as Record<string, unknown> & { remove(): void }).remove()
    this.watermarkDraw = null
  }

  // 获取是否存在水印
  hasWatermark(): boolean {
    return !!this.text.trim()
  }

  // 处理水印配置
  handleConfig(config: Record<string, unknown>): void {
    const { text, lineSpacing, textSpacing, angle, textStyle } = config
    this.text = text === undefined ? '' : String(text).trim()
    this.lineSpacing =
      typeof lineSpacing === 'number' && lineSpacing > 0 ? (lineSpacing as number) : 100
    this.textSpacing =
      typeof textSpacing === 'number' && textSpacing > 0 ? (textSpacing as number) : 100
    this.angle = typeof angle === 'number' && angle >= 0 && angle <= 90 ? (angle as number) : 30
    this.textStyle = Object.assign(this.textStyle, textStyle || {})
  }

  // 清除水印
  clear(): void {
    if (this.watermarkDraw)
      (this.watermarkDraw as Record<string, unknown> & { clear(): void }).clear()
  }

  // 绘制水印
  draw(): void {
    this.clear()
    const { onlyExport } = this.mindMap.opt.watermarkConfig
    if (onlyExport && !this.isInExport) return
    if (!this.hasWatermark()) {
      this.removeContainer()
      return
    }
    this.createContainer()
    let x = 0
    while (x < this.mindMap.width) {
      this.drawText(x)
      x += this.lineSpacing / Math.sin(degToRad(this.angle))
    }

    let yOffset = this.lineSpacing / Math.cos(degToRad(this.angle)) || this.lineSpacing
    let y = yOffset
    while (y < this.mindMap.height) {
      this.drawText(0, y)
      y += yOffset
    }
  }

  // 绘制文字
  drawText(x: number, y?: number): void {
    let long = Math.min(this.maxLong, (this.mindMap.width - x) / Math.cos(degToRad(this.angle)))
    let g = new G()
    let bbox: Record<string, unknown> | null = null
    let bboxWidth = 0
    let textHeight = -1
    while (bboxWidth < long) {
      let text = new Text().text(this.text)
      g.add(text)
      text.transform({
        translateX: bboxWidth
      })
      this.setTextStyle(text as unknown as Record<string, unknown>)
      bbox = (
        g as unknown as Record<string, unknown> & { bbox(): Record<string, unknown> }
      ).bbox() as Record<string, unknown>
      if (textHeight === -1) {
        textHeight = bbox.height as number
      }
      bboxWidth = (bbox.width as number) + this.textSpacing
    }
    let params: Record<string, unknown> = {
      rotate: this.angle,
      origin: 'top left',
      translateX: x,
      translateY: textHeight
    }
    if (y !== undefined) {
      params.translateY = y + textHeight
    }
    ;(
      g as unknown as Record<string, unknown> & { transform(p: Record<string, unknown>): void }
    ).transform(params)
    ;(this.watermarkDraw as unknown as Record<string, unknown> & { add(child: unknown): void }).add(
      g
    )
  }

  // 给文字设置样式
  setTextStyle(text: Record<string, unknown>): void {
    Object.keys(this.textStyle).forEach(item => {
      let value = this.textStyle[item]
      if (item === 'color') {
        ;(text as unknown as Record<string, unknown> & { fill(value: string): void }).fill(
          value as string
        )
      } else {
        ;(
          text as unknown as Record<string, unknown> & { css(prop: string, value: string): void }
        ).css(camelCaseToHyphen(item), value as string)
      }
    })
  }

  // 更新水印
  updateWatermark(config: Record<string, unknown>): void {
    this.mindMap.opt.watermarkConfig = merge(this.mindMap.opt.watermarkConfig, config)
    this.updateLayer()
    this.handleConfig(config)
    this.draw()
  }

  // 插件被移除前做的事情
  beforePluginRemove(): void {
    this.unBindEvent()
    this.removeContainer()
  }

  // 插件被卸载前做的事情
  beforePluginDestroy(): void {
    this.unBindEvent()
    this.removeContainer()
  }
}

export default Watermark
