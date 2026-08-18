declare class MindMapLayoutPro {
  static instanceName: string
  opt: any
  mindMap: any
  constructor(opt: any)
  init(): void
  restore(): void
  afterExecCommand(name: any): void
  layoutChange(layout: any): void
  updateRenderTree(): void
  updateNodeTree(tree: any): void
  isMindMapLayout(): boolean
  beforePluginRemove(): void
  beforePluginDestroy(): void
}
export default MindMapLayoutPro
