import { Image as SVGImage, G } from '@svgdotjs/svg.js'
interface SvgEl {
  attr(attrs: string | Record<string, unknown>, value?: unknown): this
  addClass(cls: string): this
  size(w: number, h: number): this
  add(el: unknown): this
  on(event: string, handler: (...args: unknown[]) => void): this
  addTo(parent: unknown): this
  fill(color: Record<string, unknown>): this
  stroke(style: Record<string, unknown>): this
  radius(r: number): this
  css(style: Record<string, unknown>): this
  center(x: number, y: number): void
  text(t: string): this
}
declare function getImageUrl(): any
declare function createImgNode(): {
  node: SVGImage
  width: any
  height: any
}
declare function getImgShowSize(): any[]
declare function createIconNode(): any
declare function createRichTextNode(specifyText: any): {
  node: G
  nodeContent: import('@svgdotjs/svg.js').ForeignObject
  width: any
  height: any
}
declare function createTextNode(specifyText: any): any
declare function createHyperlinkNode(): {
  node: SvgEl
  width: any
  height: any
}
declare function createTagNode(): any[]
declare function createNoteNode(): {
  node: SvgEl
  width: any
  height: any
}
declare function createAttachmentNode(): {
  node: SvgEl
  width: any
  height: any
}
declare function createCommentLabelNode(): {
  node: G
  width: number
  height: number
}
declare function getNodeIconSize(prop: any): any
declare function getNoteContentPosition(): {
  left: any
  top: any
}
declare function measureCustomNodeContentSize(content: any): {
  width: any
  height: any
}
declare function isUseCustomNodeContent(): boolean
declare const _default: {
  getImageUrl: typeof getImageUrl
  createImgNode: typeof createImgNode
  getImgShowSize: typeof getImgShowSize
  createIconNode: typeof createIconNode
  createRichTextNode: typeof createRichTextNode
  createTextNode: typeof createTextNode
  createHyperlinkNode: typeof createHyperlinkNode
  createTagNode: typeof createTagNode
  createNoteNode: typeof createNoteNode
  createAttachmentNode: typeof createAttachmentNode
  createCommentLabelNode: typeof createCommentLabelNode
  getNoteContentPosition: typeof getNoteContentPosition
  getNodeIconSize: typeof getNodeIconSize
  measureCustomNodeContentSize: typeof measureCustomNodeContentSize
  isUseCustomNodeContent: typeof isUseCustomNodeContent
}
export default _default
