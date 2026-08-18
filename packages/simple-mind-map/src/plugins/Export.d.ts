import { G } from '@svgdotjs/svg.js'
declare class Export {
  static instanceName: string
  mindMap: any
  constructor(opt: { mindMap: Record<string, unknown> })
  export(type: string, isDownload?: boolean, name?: string, ...args: unknown[]): Promise<unknown>
  createTransformImgTaskList(svg: any, tagName: string, propName: string, getUrlFn: any): any
  getSvgData(node?: Record<string, unknown>): Promise<{
    node: G
    str: string
    clipData: Record<string, unknown>
  }>
  svgToPng(
    svgSrc: string,
    transparent: boolean,
    clipData?: Record<string, unknown> | null,
    fitBg?: boolean,
    format?: string
  ): Promise<string>
  drawBackgroundToCanvas(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number
  ): Promise<void>
  drawBackgroundToSvg(svg: any): Promise<void>
  _image(
    format: string,
    name: string,
    transparent?: boolean,
    node?: Record<string, unknown> | null,
    fitBg?: boolean
  ): Promise<string>
  png(...args: unknown[]): Promise<string>
  jpg(...args: unknown[]): Promise<string>
  handleNodeExport(node: Record<string, unknown> | null): void
  pdf(name: string, transparent?: boolean, fitBg?: boolean): Promise<string>
  xmind(name: string): Promise<unknown>
  svg(name: string): Promise<unknown>
  fixSvgStrAndToBlob(str: string): Promise<unknown>
  json(name: string, withConfig?: boolean): Promise<unknown>
  smm(name: string, withConfig: boolean): Promise<unknown>
  md(): Promise<unknown>
  txt(): Promise<unknown>
}
export default Export
