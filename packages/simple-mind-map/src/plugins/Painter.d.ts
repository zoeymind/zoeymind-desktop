interface MindMapInstance {
  on(event: string, handler: Function): void
  off(event: string, handler: Function): void
  emit(event: string, ...args: unknown[]): void
  opt: Record<string, unknown> & {
    readonly: boolean
    onlyPainterNodeCustomStyles: boolean
  }
  renderer: Record<string, unknown> & {
    activeNodeList: Record<string, unknown>[]
    _handleRemoveCustomStyles(data: Record<string, unknown>): void
  }
}
interface PainterNode {
  uid: string | number
  getData(key?: string): unknown
  effectiveStyles: Record<string, unknown>
  setStyles(style: Record<string, unknown>): void
}
declare class Painter {
  static instanceName: string
  private mindMap
  private isInPainter
  private painterNode
  constructor({ mindMap }: { mindMap: MindMapInstance })
  bindEvent(): void
  unBindEvent(): void
  startPainter(): void
  endPainter(): void
  onEndPainter(): void
  painterOneNode(node: PainterNode): void
  beforePluginRemove(): void
  beforePluginDestroy(): void
}
export default Painter
