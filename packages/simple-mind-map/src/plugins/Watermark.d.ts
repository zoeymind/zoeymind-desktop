declare class Watermark {
  static instanceName: string
  private mindMap
  private lineSpacing
  private textSpacing
  private angle
  private text
  private textStyle
  private watermarkDraw
  private isInExport
  private maxLong
  constructor(opt?: Record<string, unknown>)
  getMaxLong(): number
  bindEvent(): void
  unBindEvent(): void
  onResize(): void
  createContainer(): void
  updateLayer(): void
  removeContainer(): void
  hasWatermark(): boolean
  handleConfig(config: Record<string, unknown>): void
  clear(): void
  draw(): void
  drawText(x: number, y?: number): void
  setTextStyle(text: Record<string, unknown>): void
  updateWatermark(config: Record<string, unknown>): void
  beforePluginRemove(): void
  beforePluginDestroy(): void
}
export default Watermark
