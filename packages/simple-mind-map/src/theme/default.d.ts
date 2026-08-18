export interface ThemeNodeConfig {
  shape: string
  fillColor: string
  fontFamily: string
  color: string
  fontSize: number
  fontWeight: string
  fontStyle: string
  borderColor: string
  borderWidth: number
  borderDasharray: string
  borderRadius: number
  textDecoration: string
  gradientStyle: boolean
  startColor: string
  endColor: string
  startDir: [number, number]
  endDir: [number, number]
  lineMarkerDir: string
  hoverRectColor: string
  hoverRectRadius: number
  textAlign: string
  imgPlacement: string
  tagPlacement: string
  /** 下列样式也支持给节点设置，用于覆盖最外层的设置 */
  /** 二级节点的下边距和右边距 */
  marginX?: number
  marginY?: number
}
export interface ThemeConfig {
  paddingX: number
  paddingY: number
  imgMaxWidth: number
  imgMaxHeight: number
  iconSize: number
  lineWidth: number
  lineColor: string
  lineDasharray: string
  lineFlow: boolean
  lineFlowDuration: number
  lineFlowForward: boolean
  lineStyle: string
  rootLineKeepSameInCurve: boolean
  rootLineStartPositionKeepSameInCurve: boolean
  lineRadius: number
  showLineMarker: boolean
  generalizationLineWidth: number
  generalizationLineColor: string
  generalizationLineMargin: number
  generalizationNodeMargin: number
  associativeLineWidth: number
  associativeLineColor: string
  associativeLineActiveWidth: number
  associativeLineActiveColor: string
  associativeLineDasharray: string
  associativeLineTextColor: string
  associativeLineTextFontSize: number
  associativeLineTextLineHeight: number
  associativeLineTextFontFamily: string
  backgroundColor: string
  backgroundImage: string
  backgroundRepeat: string
  backgroundPosition: string
  backgroundSize: string
  nodeUseLineStyle: boolean
  root: ThemeNodeConfig
  second: ThemeNodeConfig
  node: ThemeNodeConfig
  generalization: ThemeNodeConfig
}
declare const defaultTheme: {
  paddingX: number
  paddingY: number
  imgMaxWidth: number
  imgMaxHeight: number
  iconSize: number
  lineWidth: number
  lineColor: string
  lineDasharray: string
  lineFlow: false
  lineFlowDuration: number
  lineFlowForward: true
  lineStyle: string
  rootLineKeepSameInCurve: true
  rootLineStartPositionKeepSameInCurve: false
  lineRadius: number
  showLineMarker: false
  generalizationLineWidth: number
  generalizationLineColor: string
  generalizationLineMargin: number
  generalizationNodeMargin: number
  associativeLineWidth: number
  associativeLineColor: string
  associativeLineActiveWidth: number
  associativeLineActiveColor: string
  associativeLineDasharray: string
  associativeLineTextColor: string
  associativeLineTextFontSize: number
  associativeLineTextLineHeight: number
  associativeLineTextFontFamily: string
  backgroundColor: string
  backgroundImage: string
  backgroundRepeat: string
  backgroundPosition: string
  backgroundSize: string
  nodeUseLineStyle: false
  root: {
    shape: string
    fillColor: string
    fontFamily: string
    color: string
    fontSize: number
    fontWeight: string
    fontStyle: string
    borderColor: string
    borderWidth: number
    borderDasharray: string
    borderRadius: number
    textDecoration: string
    gradientStyle: false
    startColor: string
    endColor: string
    startDir: [number, number]
    endDir: [number, number]
    lineMarkerDir: string
    hoverRectColor: string
    hoverRectRadius: number
    textAlign: string
    imgPlacement: string
    tagPlacement: string
  }
  second: {
    shape: string
    marginX: number
    marginY: number
    fillColor: string
    fontFamily: string
    color: string
    fontSize: number
    fontWeight: string
    fontStyle: string
    borderColor: string
    borderWidth: number
    borderDasharray: string
    borderRadius: number
    textDecoration: string
    gradientStyle: false
    startColor: string
    endColor: string
    startDir: [number, number]
    endDir: [number, number]
    lineMarkerDir: string
    hoverRectColor: string
    hoverRectRadius: number
    textAlign: string
    imgPlacement: string
    tagPlacement: string
  }
  node: {
    shape: string
    marginX: number
    marginY: number
    fillColor: string
    fontFamily: string
    color: string
    fontSize: number
    fontWeight: string
    fontStyle: string
    borderColor: string
    borderWidth: number
    borderRadius: number
    borderDasharray: string
    textDecoration: string
    gradientStyle: false
    startColor: string
    endColor: string
    startDir: [number, number]
    endDir: [number, number]
    lineMarkerDir: string
    hoverRectColor: string
    hoverRectRadius: number
    textAlign: string
    imgPlacement: string
    tagPlacement: string
  }
  generalization: {
    shape: string
    marginX: number
    marginY: number
    fillColor: string
    fontFamily: string
    color: string
    fontSize: number
    fontWeight: string
    fontStyle: string
    borderColor: string
    borderWidth: number
    borderDasharray: string
    borderRadius: number
    textDecoration: string
    gradientStyle: false
    startColor: string
    endColor: string
    startDir: [number, number]
    lineMarkerDir: string
    endDir: [number, number]
    hoverRectColor: string
    hoverRectRadius: number
    textAlign: string
    imgPlacement: string
    tagPlacement: string
  }
}
export default defaultTheme
export declare const checkIsNodeSizeIndependenceConfig: (config: Record<string, unknown>) => boolean
export declare const lineStyleProps: string[]
