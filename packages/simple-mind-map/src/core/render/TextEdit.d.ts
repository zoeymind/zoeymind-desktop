import type MindMap from '../../index'
import type MindMapNode from '../render/node/MindMapNode'
import type Render from './Render'
export default class TextEdit {
  renderer: Render
  mindMap: MindMap
  currentNode: MindMapNode | null
  textEditNode: HTMLElement | null
  showTextEdit: boolean
  cacheEditingText: string
  hasBodyMousedown: boolean
  textNodePaddingX: number
  textNodePaddingY: number
  isNeedUpdateTextEditNode: boolean
  constructor(renderer: any)
  bindEvent(): void
  unBindEvent(): void
  onKeydown(e: any): void
  checkIsAutoEnterTextEditKey(e: any): boolean
  registerTmpShortcut(): void
  isShowTextEdit(): boolean
  setIsShowTextEdit(val: any): void
  show({
    node,
    isInserting,
    isFromKeyDown,
    isFromScale
  }: {
    node: any
    isInserting?: boolean
    isFromKeyDown?: boolean
    isFromScale?: boolean
  }): Promise<void>
  onOpenRealtimeRenderOnNodeTextEditConfigUpdate(openRealtimeRenderOnNodeTextEdit: any): void
  onScale(): void
  showEditTextBox({
    node,
    rect,
    isInserting,
    isFromKeyDown,
    isFromScale
  }: {
    node: any
    rect: any
    isInserting: any
    isFromKeyDown: any
    isFromScale: any
  }): void
  emitTextChangeEvent(): void
  updateTextEditNode(): void
  getBackground(node: any): any
  removeTextEditEl(): void
  getEditText(): any
  hideEditTextBox(): void
  getCurrentEditNode(): unknown
}
