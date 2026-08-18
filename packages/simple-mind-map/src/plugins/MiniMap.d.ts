declare class MiniMap {
  static instanceName: string
  mindMap: any
  isMousedown: boolean
  mousedownPos: {
    x: number
    y: number
  }
  startViewPos: {
    x: number
    y: number
  }
  currentState: any
  isViewBoxMousedown: boolean
  constructor(opt: any)
  /**
   * boxWidth：小地图容器的宽度
   * boxHeight：小地图容器的高度
   */
  calculationMiniMap(
    boxWidth: any,
    boxHeight: any
  ): {
    getImgUrl: (callback: any) => Promise<void>
    svgHTML: any
    viewBoxStyle: {
      left: number
      top: number
      right: number
      bottom: number
    }
    miniMapBoxScale: number
    miniMapBoxLeft: number
    miniMapBoxTop: number
  }
  removeNodeContent(svg: any): void
  onMousedown(e: any): void
  onMousemove(e: any, sensitivityNum?: number): void
  onMouseup(): void
  onViewBoxMousedown(e: any): void
  onViewBoxMousemove(e: any): void
}
export default MiniMap
