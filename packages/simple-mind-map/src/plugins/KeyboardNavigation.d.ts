declare class KeyboardNavigation {
  static instanceName: string
  opt: any
  mindMap: any
  constructor(opt: any)
  addShortcut(): void
  removeShortcut(): void
  onLeftKeyUp(): void
  onUpKeyUp(): void
  onRightKeyUp(): void
  onDownKeyUp(): void
  onKeyup(dir: any): void
  focus(dir: any): void
  getFocusNodeBySimpleAlgorithm({
    currentActiveNode,
    currentActiveNodeRect,
    dir,
    checkNodeDis
  }: {
    currentActiveNode: any
    currentActiveNodeRect: any
    dir: any
    checkNodeDis: any
  }): void
  getFocusNodeByShadowAlgorithm({
    currentActiveNode,
    currentActiveNodeRect,
    dir,
    checkNodeDis
  }: {
    currentActiveNode: any
    currentActiveNodeRect: any
    dir: any
    checkNodeDis: any
  }): void
  getFocusNodeByAreaAlgorithm({
    currentActiveNode,
    currentActiveNodeRect,
    dir,
    checkNodeDis
  }: {
    currentActiveNode: any
    currentActiveNodeRect: any
    dir: any
    checkNodeDis: any
  }): void
  getNodeRect(node: any): {
    right: any
    bottom: any
    left: any
    top: any
  }
  getDistance(node1Rect: any, node2Rect: any): number
  getCenter({ left, right, top, bottom }: { left: any; right: any; top: any; bottom: any }): {
    x: number
    y: number
  }
  activateNodeWithoutMoving(node: any): void
  beforePluginRemove(): void
  beforePluginDestroy(): void
}
export default KeyboardNavigation
