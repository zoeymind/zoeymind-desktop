declare function createControlNodes(node: any, toNode: any): void
declare function createOneControlNode(pointKey: any, node: any, toNode: any): any
declare function onControlPointMousedown(e: any, pointKey: any): void
declare function onControlPointMousemove(e: any): void
declare function updataAassociativeLine(
  startPoint: any,
  endPoint: any,
  point1: any,
  point2: any,
  activeLine: any
): void
declare function onControlPointMouseup(e: any): void
declare function resetControlPoint(): void
declare function renderControls(
  startPoint: any,
  endPoint: any,
  point1: any,
  point2: any,
  node: any,
  toNode: any
): void
declare function removeControls(): void
declare function hideControls(): void
declare function showControls(): void
declare const _default: {
  createControlNodes: typeof createControlNodes
  createOneControlNode: typeof createOneControlNode
  onControlPointMousedown: typeof onControlPointMousedown
  onControlPointMousemove: typeof onControlPointMousemove
  onControlPointMouseup: typeof onControlPointMouseup
  resetControlPoint: typeof resetControlPoint
  renderControls: typeof renderControls
  removeControls: typeof removeControls
  hideControls: typeof hideControls
  showControls: typeof showControls
  updataAassociativeLine: typeof updataAassociativeLine
}
export default _default
