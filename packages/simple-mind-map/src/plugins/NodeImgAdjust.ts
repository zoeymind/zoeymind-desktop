// 节点图片大小调整插件
import { resizeImgSizeByOriginRatio } from '../utils/index'
import btnsSvg from '../svg/btns'

interface MindMapInstance {
  on(event: string, handler: Function): void
  off(event: string, handler: Function): void
  emit(event: string, ...args: unknown[]): void
  draw: Record<string, unknown> & {
    rbox(): Record<string, unknown> & { x: number; y: number; x2: number; y2: number }
    transform(): Record<string, unknown> & { scaleX: number; scaleY: number }
  }
  opt: Record<string, unknown> & {
    readonly: boolean
    imgResizeBtnSize: number
    customResizeBtnInnerHTML: string
    customDeleteBtnInnerHTML: string
    beforeDeleteNodeImg: ((node: Record<string, unknown>) => boolean | Promise<boolean>) | undefined
    customInnerElsAppendTo: HTMLElement | undefined
    minImgResizeWidth: number
    minImgResizeHeight: number
    maxImgResizeWidthInheritTheme: boolean
    maxImgResizeWidth: number
    maxImgResizeHeight: number
  }
  renderer: Record<string, unknown>
  getThemeConfig(
    key: string
  ): (Record<string, unknown> & { imgMaxWidth: number; imgMaxHeight: number }) | number
  execCommand(cmd: string, node: Record<string, unknown>, data: Record<string, unknown>): void
  view: Record<string, unknown>
}

interface NodeImage {
  rbox(): Record<string, unknown> & {
    x: number
    y: number
    width: number
    height: number
    x2: number
    y2: number
  }
  hide(): void
  show(): void
}

interface MindMapNode {
  [key: string]: unknown
  uid: string | number
  getData(
    key: string
  ): Record<string, unknown> & { image: string; imageTitle: string; width: number; height: number }
}

class NodeImgAdjust {
  static instanceName: string = 'nodeImgAdjust'

  private mindMap: MindMapInstance
  private handleEl: HTMLElement | null
  private isShowHandleEl: boolean
  private node: MindMapNode | null
  private img: NodeImage | null
  private rect:
    | (Record<string, unknown> & {
        x: number
        y: number
        width: number
        height: number
        x2: number
        y2: number
      })
    | null
  private isMousedown: boolean
  private mousedownDrawTransform:
    | (Record<string, unknown> & { scaleX: number; scaleY: number })
    | null
  private mousedownOffset: { x: number; y: number }
  private currentImgWidth: number
  private currentImgHeight: number
  private isAdjusted: boolean

  constructor({ mindMap }: { mindMap: MindMapInstance }) {
    this.mindMap = mindMap
    this.handleEl = null
    this.isShowHandleEl = false
    this.node = null
    this.img = null
    this.rect = null
    this.isMousedown = false
    this.mousedownDrawTransform = null
    this.mousedownOffset = { x: 0, y: 0 }
    this.currentImgWidth = 0
    this.currentImgHeight = 0
    this.isAdjusted = false
    this.onNodeImgMouseleave = () => {}
    this.onNodeImgMousemove = () => {}
    this.onMousemove = () => {}
    this.onMouseup = () => {}
    this.onRenderEnd = () => {}
    this.onScale = () => {}
    this.bindEvent()
  }

  bindEvent(): void {
    this.onNodeImgMouseleave = this.onNodeImgMouseleave.bind(this)
    this.onNodeImgMousemove = this.onNodeImgMousemove.bind(this)
    this.onMousemove = this.onMousemove.bind(this)
    this.onMouseup = this.onMouseup.bind(this)
    this.onRenderEnd = this.onRenderEnd.bind(this)
    this.onScale = this.onScale.bind(this)
    this.mindMap.on('node_img_mouseleave', this.onNodeImgMouseleave)
    this.mindMap.on('node_img_mousemove', this.onNodeImgMousemove)
    this.mindMap.on('mousemove', this.onMousemove)
    this.mindMap.on('mouseup', this.onMouseup)
    this.mindMap.on('node_mouseup', this.onMouseup)
    this.mindMap.on('node_tree_render_end', this.onRenderEnd)
    this.mindMap.on('scale', this.onScale)
  }

  unBindEvent(): void {
    this.mindMap.off('node_img_mouseleave', this.onNodeImgMouseleave)
    this.mindMap.off('node_img_mousemove', this.onNodeImgMousemove)
    this.mindMap.off('mousemove', this.onMousemove)
    this.mindMap.off('mouseup', this.onMouseup)
    this.mindMap.off('node_mouseup', this.onMouseup)
    this.mindMap.off('node_tree_render_end', this.onRenderEnd)
    this.mindMap.off('scale', this.onScale)
  }

  onScale(): void {
    if (this.node && this.img && this.isShowHandleEl) {
      this.rect = this.img.rbox()
      this.setHandleElRect()
    }
  }

  onNodeImgMousemove(node: MindMapNode, img: NodeImage): void {
    if (
      this.isMousedown ||
      this.isAdjusted ||
      (this.mindMap.opt as Record<string, unknown>).readonly
    )
      return
    if (this.node && this.node.uid === node.uid && this.isShowHandleEl) return
    this.node = node
    this.img = img
    this.rect = img.rbox()
    this.showHandleEl()
  }

  onNodeImgMouseleave(): void {
    if (this.isMousedown) return
    this.hideHandleEl()
  }

  hideNodeImage(): void {
    if (!this.img) return
    this.img.hide()
  }

  showNodeImage(): void {
    if (!this.img) return
    this.img.show()
  }

  showHandleEl(): void {
    if (this.isShowHandleEl) return
    if (!this.handleEl) {
      this.createResizeBtnEl()
    }
    this.setHandleElRect()
    this.handleEl!.style.display = 'block'
    this.isShowHandleEl = true
  }

  hideHandleEl(): void {
    if (!this.isShowHandleEl) return
    this.isShowHandleEl = false
    this.handleEl!.style.display = 'none'
    this.handleEl!.style.backgroundImage = ''
    this.handleEl!.style.width = '0'
    this.handleEl!.style.height = '0'
    this.handleEl!.style.left = '0'
    this.handleEl!.style.top = '0'
  }

  setHandleElRect(): void {
    if (!this.rect) return
    let { width, height, x, y } = this.rect
    this.handleEl!.style.left = `${x}px`
    this.handleEl!.style.top = `${y}px`
    this.currentImgWidth = width
    this.currentImgHeight = height
    this.updateHandleElSize()
  }

  updateHandleElSize(): void {
    this.handleEl!.style.width = `${this.currentImgWidth}px`
    this.handleEl!.style.height = `${this.currentImgHeight}px`
  }

  createResizeBtnEl(): void {
    const { imgResizeBtnSize, customResizeBtnInnerHTML, customDeleteBtnInnerHTML } =
      this.mindMap.opt

    this.handleEl = document.createElement('div')
    this.handleEl.style.cssText = `
      pointer-events: none;
      position: fixed;
	    display:none;
      background-size: cover;
    `
    this.handleEl.className = 'node-img-handle'
    const btnEl = document.createElement('div')
    btnEl.innerHTML = customResizeBtnInnerHTML || (btnsSvg as Record<string, string>).imgAdjust
    btnEl.style.cssText = `
      position: absolute;
      right: 0;
      bottom: 0;
      pointer-events: auto;
      background-color: rgba(0, 0, 0, 0.3);
      width: ${imgResizeBtnSize}px;
      height: ${imgResizeBtnSize}px;
      display: flex;
      justify-content: center;
      align-items: center;
      cursor: nwse-resize;
    `
    btnEl.className = 'node-image-resize'
    btnEl.addEventListener('mouseenter', () => {
      this.showHandleEl()
    })
    btnEl.addEventListener('mouseleave', () => {
      if (this.isMousedown) return
      this.hideHandleEl()
    })
    btnEl.addEventListener('mousedown', (e: MouseEvent) => {
      e.stopPropagation()
      e.preventDefault()
      this.onMousedown(e)
    })
    btnEl.addEventListener('mouseup', () => {
      setTimeout(() => {
        this.hideHandleEl()
        this.isAdjusted = false
      }, 0)
    })
    btnEl.addEventListener('click', (e: MouseEvent) => {
      e.stopPropagation()
    })
    this.handleEl.appendChild(btnEl)
    const btnRemove = document.createElement('div')
    this.handleEl.prepend(btnRemove)
    btnRemove.className = 'node-image-remove'
    btnRemove.innerHTML = customDeleteBtnInnerHTML || (btnsSvg as Record<string, string>).remove
    btnRemove.style.cssText = `
      position: absolute;
      right: 0;top:0;color:#fff;
      pointer-events: auto;
      background-color: rgba(0, 0, 0, 0.3);
      width: ${imgResizeBtnSize}px;
      height: ${imgResizeBtnSize}px;
      display: flex;
      justify-content: center;
      align-items: center;
      cursor: pointer;
    `
    btnRemove.addEventListener('mouseenter', () => {
      this.showHandleEl()
    })
    btnRemove.addEventListener('mouseleave', () => {
      if (this.isMousedown) return
      this.hideHandleEl()
    })
    btnRemove.addEventListener('click', async () => {
      let stop = false
      if (typeof this.mindMap.opt.beforeDeleteNodeImg === 'function') {
        stop = await (
          this.mindMap.opt.beforeDeleteNodeImg as (node: MindMapNode) => boolean | Promise<boolean>
        )(this.node!)
      }
      if (!stop) {
        this.mindMap.execCommand('SET_NODE_IMAGE', this.node!, { url: null })
        this.mindMap.emit('delete_node_img_from_delete_btn', this.node)
      }
    })
    const targetNode = this.mindMap.opt.customInnerElsAppendTo || document.body
    targetNode.appendChild(this.handleEl)
  }

  onMousedown(e: MouseEvent): void {
    this.mindMap.emit('node_img_adjust_btn_mousedown', this.node)
    this.isMousedown = true
    this.mousedownDrawTransform = this.mindMap.draw.transform()
    this.hideNodeImage()
    this.mousedownOffset.x = e.clientX - (this.rect?.x2 ?? 0)
    this.mousedownOffset.y = e.clientY - (this.rect?.y2 ?? 0)
    this.handleEl!.style.backgroundImage = `url(${this.node!.getData('image').image})`
  }

  onMousemove(e: MouseEvent): void {
    if (!this.isMousedown || !this.mousedownDrawTransform || !this.rect) return
    e.preventDefault()
    const { scaleX, scaleY } = this.mousedownDrawTransform
    const { width: imageOriginWidth, height: imageOriginHeight } = this.node!.getData('imageSize')
    let {
      minImgResizeWidth,
      minImgResizeHeight,
      maxImgResizeWidthInheritTheme,
      maxImgResizeWidth,
      maxImgResizeHeight
    } = this.mindMap.opt

    const minRatio = minImgResizeWidth / minImgResizeHeight
    const oRatio = imageOriginWidth / imageOriginHeight
    if (minRatio > oRatio) {
      minImgResizeHeight = minImgResizeWidth / oRatio
    } else {
      minImgResizeWidth = minImgResizeHeight * oRatio
    }

    let imgMaxWidth: number, imgMaxHeight: number
    if (maxImgResizeWidthInheritTheme) {
      const themeConfig = this.mindMap.getThemeConfig('imgMaxWidth') as Record<string, unknown> & {
        imgMaxWidth: number
        imgMaxHeight: number
      }
      imgMaxWidth = themeConfig.imgMaxWidth
      imgMaxHeight = themeConfig.imgMaxHeight
    } else {
      imgMaxWidth = maxImgResizeWidth
      imgMaxHeight = maxImgResizeHeight
    }
    imgMaxWidth = imgMaxWidth * scaleX
    imgMaxHeight = imgMaxHeight * scaleY

    let newWidth = Math.abs(e.clientX - this.rect.x - this.mousedownOffset.x)
    let newHeight = Math.abs(e.clientY - this.rect.y - this.mousedownOffset.y)

    if (newWidth < minImgResizeWidth) newWidth = minImgResizeWidth
    if (newHeight < minImgResizeHeight) newHeight = minImgResizeHeight
    if (newWidth > imgMaxWidth) newWidth = imgMaxWidth
    if (newHeight > imgMaxHeight) newHeight = imgMaxHeight

    const [actWidth, actHeight] = resizeImgSizeByOriginRatio(
      imageOriginWidth,
      imageOriginHeight,
      newWidth,
      newHeight
    )
    this.currentImgWidth = actWidth
    this.currentImgHeight = actHeight
    this.updateHandleElSize()
  }

  onMouseup(): void {
    if (!this.isMousedown) return
    this.showNodeImage()
    this.hideHandleEl()
    const { image, imageTitle } = this.node!.getData('image')
    const { scaleX, scaleY } = this.mousedownDrawTransform!
    const newWidth = this.currentImgWidth / scaleX
    const newHeight = this.currentImgHeight / scaleY
    if (
      Math.abs(newWidth - (this.rect?.width ?? 0)) > 1 ||
      Math.abs(newHeight - (this.rect?.height ?? 0)) > 1
    ) {
      this.mindMap.execCommand('SET_NODE_IMAGE', this.node!, {
        url: image,
        title: imageTitle,
        width: newWidth,
        height: newHeight,
        custom: true
      })
      this.isAdjusted = true
    }
    this.isMousedown = false
    this.mousedownDrawTransform = null
    this.mousedownOffset.x = 0
    this.mousedownOffset.y = 0
  }

  onRenderEnd(): void {
    if (!this.isAdjusted) {
      this.hideHandleEl()
      return
    }
    this.isAdjusted = false
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

export default NodeImgAdjust
