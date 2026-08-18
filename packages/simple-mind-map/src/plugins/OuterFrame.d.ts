declare class OuterFrame {
  static instanceName: string
  static defaultStyle: Record<string, unknown>
  mindMap: any
  draw: any
  isNotRenderOuterFrames: boolean
  textNodeList: any
  outerFrameElList: any
  activeOuterFrame: any
  textEditNode: HTMLElement | null
  showTextEdit: boolean
  createText: (el: unknown, cur: unknown, range: unknown) => unknown
  getText: (node: unknown) => string
  styleTextShape: (shape: unknown, style: unknown) => void
  styleText: (textNode: unknown, style: unknown) => void
  onScale: () => void
  showEditTextBox: (g: unknown) => void
  setIsShowTextEdit: (val: boolean) => void
  removeTextEditEl: () => void
  hideEditTextBox: () => void
  updateTextEditBoxPos: (g: unknown) => void
  renderText: (str: string, rect: unknown, textNode: unknown, node: unknown, range: unknown) => void
  constructor(opt?: Record<string, unknown>)
  createDrawContainer(): void
  bindEvent(): void
  unBindEvent(): void
  onBeforeDestroy(): void
  addOuterFrame(appointNodes: any, config?: {}): void
  getActiveOuterFrame(): any
  removeActiveOuterFrame(): void
  removeActiveOuterFrameText(): void
  updateActiveOuterFrame(config?: {}): void
  updateOuterFrameStyle(): void
  getRangeNodeList(node: any, range: any): any
  getNodeRangeFirstNode(node: any, range: any): any
  renderOuterFrames(): void
  setActiveOuterFrame(el: any, node: any, range: any, textNode: any): void
  clearActiveOuterFrame(): void
  getStyle(node: any): any
  createOuterFrameEl(
    x: any,
    y: any,
    width: any,
    height: any,
    styleConfig?: Record<string, unknown>
  ): any
  styleOuterFrame(el: any, styleConfig: Record<string, unknown>): void
  clearTextNodes(): void
  clearOuterFrameElList(): void
  beforePluginRemove(): void
  beforePluginDestroy(): void
}
export default OuterFrame
