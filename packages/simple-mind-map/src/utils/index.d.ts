import { ForeignObject } from '@svgdotjs/svg.js'
export declare const walk: (
  root: any,
  parent: any,
  beforeCallback: any,
  afterCallback?: any,
  isRoot?: any,
  layerIndex?: number,
  index?: number,
  ancestors?: any[]
) => void
export declare const bfsWalk: (root: any, callback: any) => void
export declare const resizeImgSizeByOriginRatio: (
  width: any,
  height: any,
  newWidth: any,
  newHeight: any
) => any[]
export declare const resizeImgSize: (
  width: any,
  height: any,
  maxWidth: any,
  maxHeight: any
) => any[]
export declare const resizeImg: (imgUrl: any, maxWidth: any, maxHeight: any) => Promise<unknown>
export declare const getStrWithBrFromHtml: (str: any) => any
export declare const simpleDeepClone: (data: any) => any
export declare const copyRenderTree: (tree: any, root: any, removeActiveState?: boolean) => any
export declare const copyNodeTree: (
  tree: any,
  root: any,
  removeActiveState?: boolean,
  removeId?: boolean
) => any
export declare const imgToDataUrl: (src: any, returnBlob?: boolean) => Promise<unknown>
export declare const parseDataUrl: (data: any) => any
export declare const downloadFile: (file: any, fileName: any) => void
export interface CancelableThrottledFunction<Args extends unknown[] = unknown[]> {
  (...args: Args): void
  cancel(): void
}
export declare const throttle: <Args extends unknown[]>(
  fn: (...args: Args) => unknown,
  time?: number,
  ctx?: unknown
) => CancelableThrottledFunction<Args>
export declare const debounce: (fn: any, wait?: number, ctx?: any) => (...args: any[]) => void
export declare const asyncRun: (taskList: any, callback?: () => void) => void
export declare const degToRad: (deg: any) => number
export declare const camelCaseToHyphen: (str: any) => any
export declare const measureText: (
  text: any,
  {
    italic,
    bold,
    fontSize,
    fontFamily
  }: {
    italic: any
    bold: any
    fontSize: any
    fontFamily: any
  }
) => {
  width: any
  height: any
}
export declare const joinFontStr: ({
  italic,
  bold,
  fontSize,
  fontFamily
}: {
  italic: any
  bold: any
  fontSize: any
  fontFamily: any
}) => string
export declare const nextTick: (fn: any, ctx: any) => () => void
export declare const checkNodeOuter: (
  mindMap: any,
  node: any,
  offsetX?: number,
  offsetY?: number
) => {
  isOuter: boolean
  offsetLeft: number
  offsetTop: number
}
export declare const getTextFromHtml: (html: any) => any
export declare const readBlob: (blob: any) => Promise<unknown>
export declare const nodeToHTML: (node: any) => any
export declare const getImageSize: (src: any) => Promise<unknown>
export declare const createUid: () => any
export declare const loadImage: (imgFile: any) => Promise<unknown>
export declare const removeHTMLEntities: (str: any) => any
export declare const getType: (data: any) => string
export declare const isUndef: (data: any) => boolean
export declare const removeHtmlStyle: (html: any) => any
export declare const addHtmlStyle: (html: any, tag: any, style: any) => any
export declare const checkIsRichText: (str: any) => boolean
export declare const replaceHtmlText: (html: any, searchText: any, replaceText: any) => any
export declare const removeHtmlNodeByClass: (html: any, selector: any) => any
export declare const isWhite: (color: any) => boolean
export declare const isTransparent: (color: any) => boolean
export declare const getVisibleColorFromTheme: (themeConfig: any) => any
export declare const removeFormulaTags: (node: any) => void
export declare const nodeRichTextToTextWithWrap: (html: any) => string
export declare const textToNodeRichTextWithWrap: (html: any) => string
export declare const removeRichTextStyes: (html: any) => any
export declare const isMobile: () => boolean
export declare const getObjectChangedProps: (oldObject: any, newObject: any) => {}
export declare const checkIsNodeStyleDataKey: (key: any) => boolean
export declare const isNodeNotNeedRenderData: (config: any) => boolean
export declare const mergerIconList: (list: any) => any
export declare const getTopAncestorsFomNodeList: (list: any) => any[]
export declare const checkHasSupSubRelation: (list: any) => boolean
export declare const parseAddGeneralizationNodeList: (list: any) => any[]
export declare const checkTwoRectIsOverlap: (
  minx1: any,
  maxx1: any,
  miny1: any,
  maxy1: any,
  minx2: any,
  maxx2: any,
  miny2: any,
  maxy2: any
) => boolean
export declare const focusInput: (el: any) => void
export declare const selectAllInput: (el: any) => void
export declare const addDataToAppointNodes: (
  appointNodes: any,
  data?: Record<string, unknown>
) => any
export declare const createUidForAppointNodes: (
  appointNodes: any,
  createNewId?: boolean,
  handle?: any,
  handleGeneralization?: boolean
) => any
export declare const formatDataToArray: (data: any) => any[]
export declare const getNodeDataIndex: (node: any) => any
export declare const getNodeIndexInNodeList: (node: any, nodeList: any) => any
export declare const generateColorByContent: (str: any) => string
export declare const htmlEscape: (str: any) => any
export declare const isSameObject: (a: any, b: any) => boolean
export declare const checkClipboardReadEnable: () => boolean
export declare const setDataToClipboard: (data: any) => void
export declare const getDataFromClipboard: () => Promise<{
  text: any
  img: any
}>
export declare const removeFromParentNodeData: (node: any) => void
export declare const handleSelfCloseTags: (str: any) => any
export declare const checkNodeListIsEqual: (list1: any, list2: any) => boolean
export declare const getChromeVersion: () => number | ''
export declare const createSmmFormatData: (data: any) => {
  simpleMindMap: boolean
  data: any
}
export declare const checkSmmFormatData: (data: any) => {
  isSmm: boolean
  data: any
}
export declare const handleInputPasteText: (e: any, text: any) => void
export declare const transformTreeDataToObject: (data: any) => {}
export declare const transformObjectToTreeData: (data: any) => any
export declare const getTwoPointDistance: (x1: any, y1: any, x2: any, y2: any) => number
export declare const getRectRelativePosition: (
  rect1: any,
  rect2: any
) =>
  | 'left'
  | 'right'
  | 'top'
  | 'bottom'
  | 'left-top'
  | 'right-top'
  | 'right-bottom'
  | 'left-bottom'
  | 'overlap'
export declare const handleGetSvgDataExtraContent: ({
  addContentToHeader,
  addContentToFooter
}: {
  addContentToHeader: any
  addContentToFooter: any
}) => {
  cssTextList: any[]
  header: any
  headerHeight: number
  footer: any
  footerHeight: number
}
export declare const getNodeTreeBoundingRect: (
  node: any,
  x?: number,
  y?: number,
  paddingX?: number,
  paddingY?: number,
  excludeSelf?: boolean,
  excludeGeneralization?: boolean
) => {
  left: number
  top: number
  width: number
  height: number
}
export declare const getNodeListBoundingRect: (
  nodeList: any,
  x?: number,
  y?: number,
  paddingX?: number,
  paddingY?: number
) => {
  left: number
  top: number
  width: number
  height: number
}
export declare const fullscrrenEvent: string
export declare const fullScreen: (element: Record<string, (...args: unknown[]) => void>) => void
export declare const exitFullScreen: () => void
export declare const createForeignObjectNode: ({
  el,
  width,
  height
}: {
  el: unknown
  width?: number
  height?: number
}) => ForeignObject
export declare const formatGetNodeGeneralization: (data: any) => any[]
/**
 * 防御 XSS 攻击，过滤恶意 HTML 标签和属性
 * @param {string} text 需要过滤的文本
 * @returns {string} 过滤后的文本
 */
export declare const defenseXSS: (text: any) => any
export declare const addXmlns: (el: any) => void
export declare const sortNodeList: (nodeList: any) => any
export declare const mergeTheme: (dest: any, source: any) => any
export declare const getNodeRichTextStyles: (node: any) => {}
export declare const countNodeTree: (node: any) => number
export declare const compareVersion: (a: any, b: any) => '<' | '>' | '='
