interface MindMapInstance {
  on(event: string, handler: Function): void
  off(event: string, handler: Function): void
  emit(event: string, ...args: unknown[]): void
  opt: Record<string, unknown> & {
    rainbowLinesConfig: Record<string, unknown>
  }
  renderer: Record<string, unknown> & {
    renderTree: Record<string, unknown> | null
  }
  command: Record<string, unknown> & {
    addHistory(): void
  }
  render(): void
}
interface RainbowTreeNode {
  data: Record<string, unknown>
  layerIndex: number
  parent: RainbowTreeNode | null
  children?: RainbowTreeNode[]
}
declare class RainbowLines {
  static instanceName: string
  private mindMap
  constructor({ mindMap }: { mindMap: MindMapInstance })
  updateRainLinesConfig(config?: Record<string, unknown>): void
  removeNodeLineColor(): void
  getSecondLayerAncestor(node: RainbowTreeNode): RainbowTreeNode | null
  getColorsList(): string[]
  getNodeColor(node: RainbowTreeNode): string
}
export default RainbowLines
