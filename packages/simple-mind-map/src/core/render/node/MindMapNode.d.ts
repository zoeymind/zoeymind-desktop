import Style from './Style'
import Shape from './Shape'
import { G, Rect, Text, SVG } from '@svgdotjs/svg.js'
import type MindMap from '../../../index'
import type { MindMapNodeData } from '../../../types/domain'
declare class MindMapNode {
  opt: Record<string, unknown>
  nodeData: {
    data: Record<string, unknown>
    children?: unknown[]
    [key: string]: unknown
  }
  nodeDataSnapshot: string
  uid: string | undefined
  mindMap: MindMap
  renderer: {
    activeNodeList: {
      length: number
    }
    clearActiveNodeList(): void
    addNodeToActiveList(node: MindMapNode, val: boolean): void
    emitNodeActiveEvent(node?: MindMapNode | null): void
    removeNodeFromActiveList(node: MindMapNode): void
    layout: {
      renderLine(
        node: MindMapNode,
        lines: unknown[],
        styleCallback: (...args: unknown[]) => void,
        style: unknown
      ): void
      nodeIsRemoveAllLines?(node: MindMapNode): boolean
    }
    [key: string]: unknown
  }
  draw: G
  nodeDraw: G
  lineDraw: G
  style: Style
  effectiveStyles: Record<string, unknown>
  shapeInstance: Shape
  shapePadding: {
    paddingX: number
    paddingY: number
  }
  data: MindMapNodeData
  setIcon: (icons: string[]) => void
  isRoot: boolean
  isGeneralization: boolean
  generalizationBelongNode: MindMapNode | null
  layerIndex: number
  width: number
  height: number
  customTextWidth: number | undefined
  _left: number
  _top: number
  customLeft: number | undefined
  customTop: number | undefined
  isDrag: boolean
  parent: MindMapNode | null
  children: MindMapNode[]
  userList: unknown[]
  group: G | null
  shapeNode: G | null
  hoverNode: G | null
  _customNodeContent: unknown
  _imgData: unknown
  _iconData: unknown
  _textData: unknown
  _hyperlinkData: unknown
  _tagData: unknown
  _noteData: unknown
  noteEl: unknown
  noteContentIsShow: boolean
  _attachmentData: unknown
  _prefixData: unknown
  _postfixData: unknown
  _expandBtn: unknown
  _lastExpandBtnType: string | null
  _showExpandBtn: boolean
  _openExpandNode: unknown
  _closeExpandNode: unknown
  _fillExpandNode: unknown
  _userListGroup: unknown
  _lines: {
    hide(): void
    show(): void
    opacity(val: number): void
    remove(): void
  }[]
  _generalizationList: unknown[]
  _unVisibleRectRegionNode: unknown
  _isMouseenter: boolean
  _customContentAddToNodeAdd: unknown
  _rectInfo: {
    textContentWidth: number
    textContentHeight: number
    textContentWidthWithoutTag: number
  }
  _generalizationNodeWidth: number
  _generalizationNodeHeight: number
  expandBtnSize: number
  isMultipleChoice: boolean
  needLayout: boolean
  isHide: boolean
  _contentWidth: number
  _alignedWidth: number | undefined
  _commentLabelData: unknown
  layout(): void
  getNodeRect(): {
    width: number
    height: number
  }
  initQuickCreateChildBtn(): void
  initDragHandle(): void
  updateDragHandle(): void
  updateGeneralization(): void
  showExpandBtn(): void
  hideExpandBtn(): void
  removeExpandBtn(): void
  renderExpandBtn(): void
  showQuickCreateChildBtn(): void
  hideQuickCreateChildBtn(): void
  removeQuickCreateChildBtn(): void
  renderGeneralization(forceRender?: boolean): void
  removeGeneralization(): void
  hideGeneralization(): void
  showGeneralization(): void
  setGeneralizationOpacity(val: number): void
  handleGeneralizationMouseenter(): void
  handleGeneralizationMouseleave(): void
  checkHasGeneralization(): boolean
  updateUserListNode(): void
  emptyUser(): void
  updateExpandBtnPlaceholderRect(): void
  createImgNode(): unknown
  createIconNode(): unknown
  createTextNode(): unknown
  createHyperlinkNode(): unknown
  createTagNode(): unknown
  createNoteNode(): unknown
  createAttachmentNode(): unknown
  createCommentLabelNode(): unknown
  constructor(opt?: {
    mindMap?: MindMap
    renderer?: Record<string, unknown>
    data?: {
      data?: {
        customTextWidth?: number
        customLeft?: number
        customTop?: number
        [key: string]: unknown
      }
      children?: unknown[]
      [key: string]: unknown
    }
    uid?: string
    isRoot?: boolean
    isGeneralization?: boolean
    layerIndex?: number
    width?: number
    height?: number
    left?: number
    top?: number
    parent?: MindMapNode
    children?: MindMapNode[]
    [key: string]: unknown
  })
  get left(): number
  set left(val: number)
  get top(): number
  set top(val: number)
  reset(): void
  resetWhenDelete(): void
  handleData(data: any): any
  createNodeData(recreateTypes: string[] | undefined): void
  getSize(
    recreateTypes?: string[],
    opt?: {
      ignoreUpdateCustomTextWidth?: boolean
      [key: string]: unknown
    }
  ): boolean
  bindGroupEvent(): void
  active(e?: any): void
  deactivate(): void
  update(forceRender?: any): void
  getNodePosInClient(
    _left: any,
    _top: any
  ): {
    left: number
    top: number
  }
  checkIsInClient(padding?: number): boolean
  reRender(recreateTypes: any, opt: any): boolean
  updateNodeActiveClass(): void
  updateNodeByActive(active: any): void
  render(callback?: () => void, forceRender?: boolean, async?: boolean): void
  removeSelf(): void
  remove(): void
  destroy(): void
  hide(): void
  show(): void
  setOpacity(val: any): void
  hideChildren(): void
  showChildren(): void
  startDrag(): void
  endDrag(): void
  renderLine(deep?: boolean): void
  getShape(): string
  hasCustomPosition(): boolean
  ancestorHasCustomPosition(): boolean
  ancestorHasGeneralization(): boolean
  addChildren(node: any): void
  styleLine(line: any, childNode: any, enableMarker: any): void
  getRainbowLineColor(node: any): string
  removeLine(): void
  isAncestor(node: any): boolean
  isParent(node: any): boolean
  isBrother(node: any): false | MindMapNode
  getIndexInBrothers(): number
  getPaddingVale(): {
    paddingX: string
    paddingY: string
  }
  getStyle(prop: any, root?: any): string
  getSelfStyle(prop: any): unknown
  getParentSelfStyle(prop: any): any
  getSelfInhertStyle(prop: any): any
  getBorderWidth(): string | 0
  getData(): Record<string, unknown>
  getData(key: string): unknown
  getPureData(removeActiveState?: boolean, removeId?: boolean): any
  getAncestorNodes(): any[]
  hasCustomStyle(): boolean
  getRect(): import('@svgdotjs/svg.js').Box
  getRectInSvg(): {
    left: number
    right: number
    top: number
    bottom: number
    width: number
    height: number
  }
  highlight(): void
  closeHighlight(): void
  fakeClone(): MindMapNode
  createSvgTextNode(text?: string): Text
  getSvgObjects(): {
    SVG: typeof SVG
    G: typeof G
    Rect: typeof Rect
  }
  checkEnableDragModifyNodeWidth(): unknown
  hasCustomWidth(): boolean
  getChildrenLength(): number
}
export default MindMapNode
