// @ts-nocheck — vendored engine source
import { bfsWalk, throttle, checkTwoRectIsOverlap } from '../utils'
import AutoMove from '../utils/AutoMove'
import type MindMap from '../index'
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
  view: Record<string, unknown> & { x: number; y: number }
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
  toPos(x: number, y: number): { x: number; y: number }
}

// 节点选择插件
class Select {
  static instanceName: string = 'select'

  declare mindMap: MindMapInstance
  declare rect:
    | (Record<string, unknown> & { plot(points: number[][]): void; remove(): void })
    | null
  declare isMousedown: boolean
  declare mouseDownX: number
  declare mouseDownY: number
  declare mouseMoveX: number
  declare mouseMoveY: number
  declare isSelecting: boolean
  declare cacheActiveList: Record<string, unknown>[]
  declare autoMove: AutoMove
  declare lastTranslateX: number
  declare lastTranslateY: number

  //  构造函数
  constructor({ mindMap }: { mindMap: MindMapInstance }) {
    this.mindMap = mindMap
    this.rect = null
    this.isMousedown = false
    this.mouseDownX = 0
    this.mouseDownY = 0
    this.mouseMoveX = 0
    this.mouseMoveY = 0
    this.isSelecting = false
    this.cacheActiveList = []
    this.autoMove = new AutoMove(mindMap as unknown as MindMap)
    this.lastTranslateX = 0
    this.lastTranslateY = 0
    this.bindEvent()
  }

  //  绑定事件
  bindEvent(): void {
    this.onMousedown = this.onMousedown.bind(this)
    this.onMousemove = this.onMousemove.bind(this)
    this.onMouseup = this.onMouseup.bind(this)
    this.onTranslate = this.onTranslate.bind(this)
    this.checkInNodes = throttle(this.checkInNodes, 300, this)

    this.mindMap.on('mousedown', this.onMousedown)
    this.mindMap.on('mousemove', this.onMousemove)
    this.mindMap.on('mouseup', this.onMouseup)
    this.mindMap.on('node_mouseup', this.onMouseup)
    this.mindMap.on('translate', this.onTranslate)
  }

  // 解绑事件
  unBindEvent(): void {
    this.mindMap.off('mousedown', this.onMousedown)
    this.mindMap.off('mousemove', this.onMousemove)
    this.mindMap.off('mouseup', this.onMouseup)
    this.mindMap.off('node_mouseup', this.onMouseup)
    this.mindMap.off('translate', this.onTranslate)
  }

  // 鼠标按下
  onMousedown(e: MouseEvent): void {
    const { readonly, mousedownEventPreventDefault } = this.mindMap.opt
    if (readonly) {
      return
    }
    let { useLeftKeySelectionRightKeyDrag } = this.mindMap.opt
    if (
      !(e.ctrlKey || e.metaKey) &&
      (useLeftKeySelectionRightKeyDrag ? e.which !== 1 : e.which !== 3)
    ) {
      return
    }
    if (mousedownEventPreventDefault) {
      e.preventDefault()
    }
    this.isMousedown = true
    this.cacheActiveList = [...this.mindMap.renderer.activeNodeList]
    // 初始化当前画布的平移坐标
    this.lastTranslateX = this.mindMap.view.x
    this.lastTranslateY = this.mindMap.view.y
    let { x, y } = this.mindMap.toPos(e.clientX, e.clientY)
    this.mouseDownX = x
    this.mouseDownY = y
    this.createRect(x, y)
  }

  // 鼠标移动
  onMousemove(e: MouseEvent): void {
    if (this.mindMap.opt.readonly) {
      return
    }
    if (!this.isMousedown) {
      return
    }
    let { x, y } = this.mindMap.toPos(e.clientX, e.clientY)
    this.mouseMoveX = x
    this.mouseMoveY = y
    if (Math.abs(x - this.mouseDownX) <= 10 && Math.abs(y - this.mouseDownY) <= 10) {
      return
    }
    this.autoMove.clearAutoMoveTimer()
    this.autoMove.onMove(
      e.clientX,
      e.clientY,
      (() => {
        this.isSelecting = true
        // 绘制矩形
        this.updateRect()
        this.checkInNodes()
      }) as unknown as (...args: unknown[]) => void,
      ((dir: string, step: number) => {
        switch (dir) {
          case 'left':
            this.mouseDownX += step
            break
          case 'top':
            this.mouseDownY += step
            break
          case 'right':
            this.mouseDownX -= step
            break
          case 'bottom':
            this.mouseDownY -= step
            break
          default:
            break
        }
      }) as unknown as (...args: unknown[]) => void
    )
  }

  // 结束框选
  onMouseup(): void {
    if (this.mindMap.opt.readonly) {
      return
    }
    if (!this.isMousedown) {
      return
    }
    this.checkTriggerNodeActiveEvent()
    this.autoMove.clearAutoMoveTimer()
    this.isMousedown = false
    this.cacheActiveList = []
    if (this.rect) this.rect.remove()
    this.rect = null
    setTimeout(() => {
      this.isSelecting = false
    }, 0)
  }

  // 画布平移时调整选择框起始坐标
  onTranslate(x: number, y: number): void {
    // 只有在正在进行选择时才需要调整坐标
    if (this.isMousedown && this.isSelecting) {
      const dx = x - this.lastTranslateX
      const dy = y - this.lastTranslateY

      this.mouseDownX += dx
      this.mouseDownY += dy

      // 重新绘制矩形
      this.updateRect()
    }

    // 更新记录的坐标
    this.lastTranslateX = x
    this.lastTranslateY = y
  }

  // 如果激活节点改变了，那么触发事件
  checkTriggerNodeActiveEvent(): void {
    let isNumChange = this.cacheActiveList.length !== this.mindMap.renderer.activeNodeList.length
    let isNodeChange = false
    if (!isNumChange) {
      for (let i = 0; i < this.cacheActiveList.length; i++) {
        let cur = this.cacheActiveList[i]
        if (
          !this.mindMap.renderer.activeNodeList.find((item: Record<string, unknown>) => {
            return (
              (item as Record<string, unknown> & { getData(key: string): string }).getData(
                'uid'
              ) ===
              (cur as Record<string, unknown> & { getData(key: string): string }).getData('uid')
            )
          })
        ) {
          isNodeChange = true
          break
        }
      }
    }
    if (isNumChange || isNodeChange) {
      this.mindMap.renderer.emitNodeActiveEvent()
    }
  }

  //  创建矩形
  createRect(x: number, y: number): void {
    if (this.rect) this.rect.remove()
    const rect = (
      this.mindMap.svg as unknown as Record<string, unknown> & {
        polygon(): Record<string, unknown>
      }
    ).polygon()
    ;(
      rect as Record<string, unknown> & {
        stroke(s: Record<string, unknown>): Record<string, unknown>
      }
    ).stroke({ color: '#0984e3' })
    ;(
      rect as Record<string, unknown> & {
        fill(s: Record<string, unknown>): Record<string, unknown>
      }
    ).fill({ color: 'rgba(9,132,227,0.3)' })
    ;(rect as Record<string, unknown> & { plot(p: number[][]): Record<string, unknown> }).plot([
      [x, y]
    ])
    this.rect = rect as unknown as Record<string, unknown> & {
      plot(points: number[][]): void
      remove(): void
    }
  }

  // 更新矩形位置
  updateRect(): void {
    if (this.rect) {
      this.rect.plot([
        [this.mouseDownX, this.mouseDownY],
        [this.mouseMoveX, this.mouseDownY],
        [this.mouseMoveX, this.mouseMoveY],
        [this.mouseDownX, this.mouseMoveY]
      ])
    }
  }

  //  检测在选区里的节点
  checkInNodes(): void {
    let { scaleX, scaleY, translateX, translateY } = (
      this.mindMap.draw as Record<string, unknown> & {
        transform(): { scaleX: number; scaleY: number; translateX: number; translateY: number }
      }
    ).transform()
    let minx = Math.min(this.mouseDownX, this.mouseMoveX)
    let miny = Math.min(this.mouseDownY, this.mouseMoveY)
    let maxx = Math.max(this.mouseDownX, this.mouseMoveX)
    let maxy = Math.max(this.mouseDownY, this.mouseMoveY)

    const check = (
      node: Record<string, unknown> & { left: number; top: number; width: number; height: number }
    ) => {
      let { left, top, width, height } = node
      let right = (left + width) * scaleX + translateX
      let bottom = (top + height) * scaleY + translateY
      left = left * scaleX + translateX
      top = top * scaleY + translateY
      const isActive = (
        node as unknown as Record<string, unknown> & { getData(key: string): unknown }
      ).getData('isActive')
      if (checkTwoRectIsOverlap(minx, maxx, miny, maxy, left, right, top, bottom)) {
        if (isActive) {
          return
        }
        ;(
          this.mindMap.renderer as {
            addNodeToActiveList(n: Record<string, unknown>): void
            emitNodeActiveEvent(): void
          }
        ).addNodeToActiveList(node as unknown as Record<string, unknown>)
        ;(this.mindMap.renderer as { emitNodeActiveEvent: () => void }).emitNodeActiveEvent()
      } else if (isActive) {
        ;(
          this.mindMap.renderer as { removeNodeFromActiveList(n: Record<string, unknown>): void }
        ).removeNodeFromActiveList(node as unknown as Record<string, unknown>)
        ;(this.mindMap.renderer as { emitNodeActiveEvent(): void }).emitNodeActiveEvent()
      }
    }

    bfsWalk((this.mindMap.renderer as Record<string, unknown> & { root: unknown }).root, ((
      node: Record<string, unknown> & {
        left: number
        top: number
        width: number
        height: number
        _generalizationList?: { generalizationNode: unknown }[]
      }
    ) => {
      check(node)
      // 概要节点
      if (node._generalizationList && node._generalizationList.length > 0) {
        node._generalizationList.forEach(item => {
          check(
            item.generalizationNode as Record<string, unknown> & {
              left: number
              top: number
              width: number
              height: number
            }
          )
        })
      }
    }) as unknown as (node: unknown, parent: unknown) => void | 'stop')
  }

  // 是否存在选区
  hasSelectRange(): boolean {
    return this.isSelecting
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

export default Select