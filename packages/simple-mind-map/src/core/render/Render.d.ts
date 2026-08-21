import TextEdit from './TextEdit'
import { Polygon } from '@svgdotjs/svg.js'
import type { default as MainMindMap } from '../../index'
declare class Render {
  opt: Record<string, unknown>
  mindMap: MainMindMap
  themeConfig: Record<string, unknown>
  renderTree: Record<string, unknown> | null
  reRender: boolean
  isRendering: boolean
  hasWaitRendering: boolean
  nodeCache: Record<string, import('./node/MindMapNode').default>
  lastNodeCache: Record<string, import('./node/MindMapNode').default>
  renderSourceList: unknown[]
  renderCallbackList: ((...args: unknown[]) => void)[]
  activeNodeList: import('./node/MindMapNode').default[]
  emitNodeActiveEventTimer: ReturnType<typeof setTimeout> | null
  renderTimer: ReturnType<typeof setTimeout> | null
  root: import('./node/MindMapNode').default | null
  textEdit: TextEdit
  beingCopyData: unknown
  highlightBoxNode: Polygon | null
  highlightBoxNodeStyle: Record<string, unknown> | null
  lastActiveNodeList: unknown[]
  layout: any
  constructor(opt?: Record<string, unknown>)
  setLayout(): void
  setData(data: any): void
  bindEvent(): void
  onNodeTextEditChange({ node, text }: { node: any; text: any }): void
  forceLoadNode(node?: any): void
  registerCommands(): void
  registerShortcutKeys(): void
  emitNodeActiveEvent(node?: any, activeNodeList?: import('./node/MindMapNode').default[]): void
  clearActiveNodeListOnDrawClick(e: any, eventType: any): void
  startTextEdit(): void
  endTextEdit(): void
  clearCache(): void
  addRenderParams(callback: any, source: any): void
  checkHasRenderSource(val: any): boolean
  onRenderEnd(): void
  render(callback?: any, source?: any): void
  _render(): void
  renderByCustomNodeContentNode(node: any): void
  resetUnExpandNodeStyle(): void
  clearActiveNode(): void
  clearActiveNodeList(): void
  addNodeToActiveList(node: any, notEmitBeforeNodeActiveEvent?: boolean): void
  removeNodeFromActiveList(node: any): void
  activeMultiNode(nodeList?: any[]): void
  cancelActiveMultiNode(nodeList?: any[]): void
  findActiveNodeIndex(node: any): any
  selectAll(): void
  back(step: any): void
  forward(step: any): void
  backForward(type: any, step: any): void
  getNewNodeBehavior(
    openEdit?: boolean,
    handleMultiNodes?: boolean
  ): {
    focusNewNode: boolean
    inserting: boolean
  }
  insertNode(
    openEdit?: boolean,
    appointNodes?: any[],
    appointData?: any,
    appointChildren?: any[]
  ): void
  insertMultiNode(appointNodes: any, nodeList: any): void
  insertChildNode(
    openEdit?: boolean,
    appointNodes?: any[],
    appointData?: any,
    appointChildren?: any[]
  ): void
  insertMultiChildNode(appointNodes: any, childList: any): void
  insertParentNode(openEdit: boolean, appointNodes: any, appointData: any): void
  upNode(appointNode: any): void
  downNode(appointNode: any): void
  moveUpOneLevel(node: any): void
  _handleRemoveCustomStyles(nodeData: any): boolean
  removeCustomStyles(node: any): void
  removeAllNodeCustomStyles(appointNodes: any): void
  copy(): void
  cut(): void
  handlePaste(event: any): void
  paste(): Promise<void>
  insertBefore(node: any, exist: any): void
  insertAfter(node: any, exist: any): void
  insertTo(node: any, exist: any, dir?: string): void
  removeNode(appointNodes?: any[]): void
  deleteNodeGeneralization(node: any): void
  removeCurrentNode(appointNodes?: any[]): void
  getNextActiveNode(deleteList: any): any
  copyNode(): any[]
  cutNode(callback: any): void
  moveNodeTo(node: any, toNode: any): void
  moveNodeDataToIndex(
    nodeData: { data: Record<string, unknown>; children?: unknown[] },
    fromParentData: { data: Record<string, unknown>; children?: unknown[] },
    toParentData: { data: Record<string, unknown>; children?: unknown[] },
    index: number
  ): void
  pasteNode(data: any): void
  setNodeStyle(node: any, prop: any, value: any): void
  setNodeStyles(node: any, style: any): void
  setNodeActive(node: any, active: any): void
  setNodeExpand(node: any, expand: any): void
  expandAllNode(uid?: string): void
  unexpandAllNode(isSetRootNodeCenter?: boolean, uid?: string): void
  expandToLevel(level: any): void
  toggleActiveExpand(): void
  toggleNodeExpand(node: any): void
  setNodeText(node: any, text: any, richText: any, resetRichText: any): void
  setNodeImage(node: any, data: any): void
  setNodeIcon(node: any, icons: any): void
  setNodeHyperlink(node: any, link: any, title?: string): void
  setNodeNote(node: any, note: any): void
  setNodeAttachment(node: any, url: any, name?: string): void
  setNodeTag(node: any, tag: any): void
  insertFormula(formula: any, appointNodes?: any[]): void
  addGeneralization(data: any, openEdit?: boolean): void
  removeGeneralization(): void
  setNodeCustomPosition(node: any, left?: any, top?: any): void
  resetLayout(): void
  setNodeShape(node: any, shape: any): void
  goTargetNode(node: any, callback?: (...args: unknown[]) => void): void
  setNodeData(node: any, data: any): void
  setNodeDataRender(node: any, data: any, notRender?: boolean): void
  reRenderNodeCheckChange(node: any, notRender?: any): void
  moveNodeToCenter(node: any, resetScale?: any): void
  setRootNodeCenter(): void
  expandToNodeUid(uid: any, callback?: () => void): void
  findNodeByUid(uid: any): any
  findNodeDataByUid(uid: any): any
  highlightNode(node: any, range: any, style: any): void
  closeHighlightNode(): void
  hasRichTextPlugin(): boolean
}
export default Render
