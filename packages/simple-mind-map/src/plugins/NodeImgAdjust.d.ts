interface MindMapInstance {
  on(event: string, handler: Function): void
  off(event: string, handler: Function): void
  emit(event: string, ...args: unknown[]): void
  draw: Record<string, unknown> & {
    rbox(): Record<string, unknown> & {
      x: number
      y: number
      x2: number
      y2: number
    }
    transform(): Record<string, unknown> & {
      scaleX: number
      scaleY: number
    }
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
  getThemeConfig(key: string):
    | (Record<string, unknown> & {
        imgMaxWidth: number
        imgMaxHeight: number
      })
    | number
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
  getData(key: string): Record<string, unknown> & {
    image: string
    imageTitle: string
    width: number
    height: number
  }
}
declare class NodeImgAdjust {
  static instanceName: string
  private mindMap
  private handleEl
  private isShowHandleEl
  private node
  private img
  private rect
  private isMousedown
  private mousedownDrawTransform
  private mousedownOffset
  private currentImgWidth
  private currentImgHeight
  private isAdjusted
  constructor({ mindMap }: { mindMap: MindMapInstance })
  bindEvent(): void
  unBindEvent(): void
  onScale(): void
  onNodeImgMousemove(node: MindMapNode, img: NodeImage): void
  onNodeImgMouseleave(): void
  hideNodeImage(): void
  showNodeImage(): void
  showHandleEl(): void
  hideHandleEl(): void
  setHandleElRect(): void
  updateHandleElSize(): void
  createResizeBtnEl(): void
  onMousedown(e: MouseEvent): void
  onMousemove(e: MouseEvent): void
  onMouseup(): void
  onRenderEnd(): void
  beforePluginRemove(): void
  beforePluginDestroy(): void
}
export default NodeImgAdjust
