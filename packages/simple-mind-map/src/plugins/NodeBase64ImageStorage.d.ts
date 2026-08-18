interface MindMapInstance {
  on(event: string, handler: Function): void
  off(event: string, handler: Function): void
  emit(event: string, ...args: unknown[]): void
  renderer: Record<string, unknown> & {
    renderTree: Record<string, unknown> | null
  }
}
declare class NodeBase64ImageStorage {
  static instanceName: string
  private opt
  private mindMap
  constructor(opt: { mindMap: MindMapInstance })
  bindEvent(): void
  unBindEvent(): void
  isBase64ImgUrl(url: string): boolean
  isImageKey(url: string): boolean
  createImageKey(): string
  onBeforeAddHistory(): void
  beforePluginRemove(): void
  beforePluginDestroy(): void
}
export default NodeBase64ImageStorage
