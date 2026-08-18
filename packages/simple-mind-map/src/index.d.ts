import type { Svg } from '@svgdotjs/svg.js'
import { CONSTANTS, ERROR_TYPES } from './constants/constant'
import { SVG, G, Rect } from '@svgdotjs/svg.js'
import { transformObjectToTreeData, createUid, transformTreeDataToObject } from './utils'
import type {
  MindMapNode,
  MindMapNodeData,
  MindMapNodeTree,
  MindMapOptions,
  CooperatePlugin,
  DrawInterface,
  PluginInstanceMap,
  NodeData,
  WatermarkPlugin
} from './types/domain'
export { transformObjectToTreeData, CONSTANTS, ERROR_TYPES }
declare class MindMap {
  el: HTMLElement
  opt: MindMapOptions & {
    useLeftKeySelectionRightKeyDrag?: boolean
    dragTargetType?: 'canvas' | 'node'
    mousewheelAction?: 'zoom' | 'move'
    enableFreeDrag?: boolean
    fit?: boolean
    addHistoryOnInit?: boolean
    addHistoryTime?: number
    errorHandler?: (type: string, error: unknown) => void
    watermarkConfig?: Record<string, unknown>
    openPerformance?: boolean
    [key: string]: unknown
  }
  projectId?: string
  __waitingForCollaboration?: boolean
  initWidth: number
  initHeight: number
  width: number
  height: number
  elRect: DOMRect
  cssEl: HTMLStyleElement | null
  cssTextMap: Record<string, string>
  themeConfig: Record<string, unknown>
  commonCaches: {
    measureCustomNodeContentSizeEl: HTMLElement | null
    measureRichtextNodeTextSizeEl: HTMLElement | null
  }
  nodeInnerPrefixList: Array<Record<string, unknown>>
  nodeInnerPostfixList: Array<Record<string, unknown>>
  editNodeClassList: string[]
  extendShapeList: Array<Record<string, unknown>>
  svg: Svg
  draw: G
  lineDraw: G
  associativeLineDraw: G
  nodeDraw: G
  otherDraw: G
  event: import('./core/event/Event').default
  keyCommand: import('./core/command/KeyCommand').default
  command: import('./core/command/Command').default
  renderer: import('./core/render/Render').default
  view: import('./core/view/View').default
  batchExecution: import('./utils/BatchExecution').default
  cooperate?: PluginInstanceMap['cooperate']
  comment?: PluginInstanceMap['comment']
  search?: PluginInstanceMap['search']
  scrollbar?: PluginInstanceMap['scrollbar']
  doExport?: PluginInstanceMap['doExport']
  ghostCompletion?: PluginInstanceMap['ghostCompletion']
  demonstrate?: {
    isInDemonstrate?: boolean
    [key: string]: unknown
  }
  watermark?: WatermarkPlugin
  richText?: {
    showTextEdit: boolean
    showEditText(params: Record<string, unknown>): void
    hideEditText(): void
    updateTextEditNode(): void
    removeTextEditEl(): void
    cacheEditingText: string
    node: unknown
    getEditText(): string
    onOpenRealtimeRenderOnNodeTextEditConfigUpdate(openRealtimeRenderOnNodeTextEdit: boolean): void
  }
  static instanceCount: number
  static pluginList: Array<Record<string, unknown>>
  static extendNodeDataNoStylePropList: (list?: string[]) => void
  static resetNodeDataNoStylePropList: () => void
  static usePlugin: (plugin: object, opt?: Record<string, unknown>) => typeof MindMap
  static hasPlugin: (plugin: object) => number
  static defineTheme: (name: string, config?: Record<string, unknown>) => void | Error
  static removeTheme: (name: string) => void
  /**
   *
   * @param {defaultOpt} opt
   */
  constructor(opt?: {})
  handleOpt(opt: any): any
  handleData(data: any): any
  initContainer(): void
  clearDraw(): void
  appendCss(key: any, str: any): void
  removeAppendCss(key: any): void
  joinCss(): string
  addCss(): void
  removeCss(): void
  checkEditNodeClassIndex(className: any): number
  addEditNodeClass(className: any): void
  deleteEditNodeClass(className: any): void
  render(callback?: (...args: unknown[]) => void, source?: string): void
  reRender(callback?: (...args: unknown[]) => void, source?: string): void
  getElRectInfo(): void
  resize(): void
  on(event: string, fn: (...args: any[]) => void): void
  emit(event: string, ...args: unknown[]): void
  off(event: string, fn?: (...args: any[]) => void): void
  initCache(): void
  initTheme(): void
  setTheme(theme: string, notRender?: boolean): void
  getTheme(): string
  setThemeConfig(config: Record<string, unknown>, notRender?: boolean): void
  getCustomThemeConfig(): Record<string, unknown>
  getThemeConfig(prop: string): unknown
  getConfig(prop: string): unknown
  updateConfig(opt?: Record<string, unknown>): void
  getLayout(): string
  setLayout(layout: string, notRender?: boolean): void
  execCommand(command: string, ...args: unknown[]): void
  updateData(data: MindMapNodeTree): void
  setData(data: MindMapNodeTree): void
  setFullData(data: {
    root?: MindMapNodeTree
    layout?: string
    theme?: {
      template?: string
      config?: Record<string, unknown>
    }
    view?: {
      scale?: number
      translateX?: number
      translateY?: number
    }
  }): void
  getData(): MindMapNodeTree
  getData(withConfig: false): MindMapNodeTree
  getData(withConfig: true): {
    root: MindMapNodeTree
    layout: string
    theme: {
      template: string
      config: Record<string, unknown>
    }
    view: {
      scale: number
      translateX: number
      translateY: number
    }
  }
  export(
    type: string,
    isDownload?: boolean,
    name?: string,
    ...args: unknown[]
  ): Promise<string | Blob>
  toPos(
    x: number,
    y: number
  ): {
    x: number
    y: number
  }
  setMode(mode: 'readonly' | 'edit'): void
  getSvgData({
    paddingX,
    paddingY,
    ignoreWatermark,
    addContentToHeader,
    addContentToFooter,
    node
  }?: {
    paddingX?: number
    paddingY?: number
    ignoreWatermark?: boolean
    addContentToHeader?: (...args: unknown[]) => unknown
    addContentToFooter?: (...args: unknown[]) => unknown
    node?: MindMapNode
  }): {
    svg: Svg
    svgHTML: string
    clipData: any
    rect: {
      ratio: number
      height: number
      width: number
      y: number
      x: number
      cx: number
      cy: number
      w: number
      h: number
      x2: number
      y2: number
    }
    origWidth: number
    origHeight: number
    scaleX: number
    scaleY: number
  }
  addShape(shape: Record<string, unknown>): void
  removeShape(name: string): void
  getSvgObjects(): {
    SVG: typeof SVG
    G: typeof G
    Rect: typeof Rect
  }
  addPlugin(
    plugin: {
      new (options: Record<string, unknown>): Record<string, unknown>
      instanceName?: string
    },
    opt?: Record<string, unknown>
  ): void
  removePlugin(plugin: {
    new (options: Record<string, unknown>): Record<string, unknown>
    instanceName?: string
  }): void
  initPlugin(plugin: {
    new (options: Record<string, unknown>): Record<string, unknown>
    instanceName?: string
  }): void
  destroy(): void
}
export type {
  MindMapNode,
  MindMapNodeData,
  MindMapNodeTree,
  MindMapOptions,
  CooperatePlugin,
  DrawInterface,
  PluginInstanceMap,
  NodeData
}
export { createUid, transformTreeDataToObject }
export default MindMap
