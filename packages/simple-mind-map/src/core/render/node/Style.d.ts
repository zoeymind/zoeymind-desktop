export declare const shapeStyleProps: string[]
declare class Style {
  ctx: {
    mindMap: {
      themeConfig: Record<string, unknown>
      painter?: unknown
      opt: Record<string, unknown>
    }
    isGeneralization: boolean
    layerIndex: number
    nodeDraw: Record<string, unknown>
    lineDraw: Record<string, unknown>
    getData(prop: string): unknown
    effectiveStyles: Record<string, unknown>
    [key: string]: unknown
  }
  _markerPath: Record<string, unknown>
  _marker: Record<string, unknown>
  _gradient: Record<string, unknown>
  hasCustomStyle: () => boolean
  static cacheStyle: Record<string, string> | null
  static setBackgroundStyle(el: any, themeConfig: any): void
  static removeBackgroundStyle(el: any): void
  constructor(ctx: any)
  merge(prop: any, root?: any): string
  getStyle(prop: any, root?: any): string
  getSelfStyle(prop: any): unknown
  addToEffectiveStyles(styles: any): void
  rect(node: any): void
  shape(node: any): void
  text(node: any): void
  domText(node: any, fontSizeScale?: number): void
  tagText(node: any, style: any): void
  tagRect(node: any, style: any): void
  iconNode(node: any, color?: any): void
  line(
    line: any,
    { width, color, dasharray }?: Record<string, unknown>,
    enableMarker?: any,
    childNode?: any
  ): void
  createMarker(): unknown
  generalizationLine(node: any): void
  iconBtn(openNode: any, closeNode: any, fillNode: any): void
  hoverNode(hoverNode: any, width: any, height: any): void
  focusNode(node: any): void
  removeFocusNode(node: any): void
  onRemove(): void
}
export default Style
