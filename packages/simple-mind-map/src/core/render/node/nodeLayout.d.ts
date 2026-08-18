declare function getImgTextMarin(
  dir: any,
  imgWidth: any,
  textWidth: any,
  imgHeight: any,
  textHeight: any
): any
declare function getTagContentSize(space: any): {
  width: any
  height: number
}
declare function getNodeRect(): {
  width: any
  height: any
}
declare function addHoverNode(width: any, height: any): void
declare function customNodeContentRealtimeLayout(): void
declare function layout(): void
declare const _default: {
  getImgTextMarin: typeof getImgTextMarin
  getTagContentSize: typeof getTagContentSize
  getNodeRect: typeof getNodeRect
  addHoverNode: typeof addHoverNode
  layout: typeof layout
  customNodeContentRealtimeLayout: typeof customNodeContentRealtimeLayout
}
export default _default
