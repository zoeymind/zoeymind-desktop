import Quill from 'quill'
import 'quill/dist/quill.snow.css'
interface MindMapInstance {
  on(event: string, handler: Function, context?: unknown): void
  off(event: string, handler: Function): void
  emit(event: string, ...args: unknown[]): void
  opt: Record<string, unknown> & {
    customInnerElsAppendTo: HTMLElement | null
    nodeTextEditZIndex: string
    textAutoWrapWidth: number
    selectTextOnEnterEditText: boolean
    transformRichTextOnEnterEdit: ((text: string) => string) | undefined
    openRealtimeRenderOnNodeTextEdit: boolean
    autoEmptyTextWhenKeydownEnterEdit: boolean
    beforeHideRichTextEdit: ((instance: RichText) => void) | undefined
    readonly: boolean
    selectTranslateStep: number
    selectTranslateLimit: number
    data?: Record<string, unknown>
  }
  keyCommand: Record<string, unknown> & {
    stopCheckInSvg(): void
    recoveryCheckInSvg(): void
  }
  renderer: Record<string, unknown> & {
    renderTree: Record<string, unknown> | null
    textEdit: Record<string, unknown> & {
      registerTmpShortcut(): void
      checkIsAutoEnterTextEditKey(e: KeyboardEvent): boolean
      getBackground(node: Record<string, unknown>): string
    }
    findNodeByUid(uid: string): Record<string, unknown> | undefined
  }
  command: Record<string, unknown> & {
    clearHistory(): void
    addHistory(): void
  }
  execCommand(command: string, ...args: unknown[]): void
  render(): void
  addEditNodeClass(className: string): void
  deleteEditNodeClass(className: string): void
  appendCss(id: string, css: string): void
  removeAppendCss(id: string): void
}
declare class RichText {
  static instanceName: string
  mindMap: MindMapInstance
  pluginOpt: Record<string, unknown> & {
    fontFamilyList?: string[]
    fontSizeList?: string[]
  }
  textEditNode: HTMLDivElement | null
  showTextEdit: boolean
  quill: Quill | null
  range: Record<string, unknown> | null
  lastRange: Record<string, unknown> | null
  pasteUseRange: Record<string, unknown> | null
  node: Record<string, unknown> | null
  isInserting: boolean
  styleEl: HTMLStyleElement | null
  cacheEditingText: string
  isCompositing: boolean
  textNodePaddingX: number
  textNodePaddingY: number
  constructor({
    mindMap,
    pluginOpt
  }: {
    mindMap: MindMapInstance
    pluginOpt: Record<string, unknown> & {
      fontFamilyList?: string[]
      fontSizeList?: string[]
    }
  })
  bindEvent(): void
  unbindEvent(): void
  appendCss(): void
  initOpt(): void
  extendQuill(): void
  extendFont(list?: string[], cover?: boolean): void
  extendAlign(): void
  showEditText({
    node,
    rect,
    isInserting,
    isFromKeyDown,
    isFromScale
  }: {
    node: Record<string, unknown> & {
      hasCustomWidth(): boolean
      customTextWidth: number
      _textData: Record<string, unknown> & {
        node: {
          node: HTMLElement
          attr(name: string): number
        }
      }
      getData(key: string): unknown
    }
    rect?: DOMRect
    isInserting?: boolean
    isFromKeyDown?: boolean
    isFromScale?: boolean
  }): void
  onOpenRealtimeRenderOnNodeTextEditConfigUpdate(openRealtimeRenderOnNodeTextEdit: boolean): void
  addNodeTextStyleToTextEditNode(node: Record<string, unknown>): void
  setQuillContainerMinHeight(minHeight: number): void
  updateTextEditNode(): void
  removeTextEditEl(): void
  getEditText(): string
  hideEditText(nodes?: Record<string, unknown>[]): void
  initQuillEditor(): void
  getPasteTextStyle(): Record<string, unknown>
  formatPasteText(text: string): string
  onCompositionStart(): void
  onCompositionUpdate(): void
  onCompositionEnd(): void
  setIsShowTextEdit(val: boolean): void
  selectAll(): void
  focus(start: number | null): void
  formatText(config?: Record<string, unknown>, clear?: boolean): void
  removeFormat(): void
  formatRangeText(range: Record<string, unknown>, config?: Record<string, unknown>): void
  formatAllText(config?: Record<string, unknown>): void
  normalStyleToRichTextStyle(style: Record<string, unknown>): Record<string, unknown>
  richTextStyleToNormalStyle(config: Record<string, unknown>): Record<string, unknown>
  isHasRichTextStyle(obj: Record<string, unknown>): boolean
  checkNodeHasCustomRichTextStyle(node: Record<string, unknown>): boolean
  afterHandleData(): void
  handleDataToRichTextOnInit(): void
  transformAllNodesToNormalNode(): void
  handleDataToRichText(data: Record<string, unknown>): void
  handleSetData(data: Record<string, unknown>): Record<string, unknown>
  beforePluginRemove(): void
  beforePluginDestroy(): void
}
export default RichText
