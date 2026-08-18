export interface ExpandBtnStyle {
  color: string
  fill: string
  fontSize: number
  strokeColor: string
}
export interface ExpandBtnIcon {
  open: string
  close: string
}
export interface CooperateStyle {
  avatarSize: number
  fontSize: number
  overlapRatio: number
  chipWidth: number
  chipGap: number
}
export interface NoteIcon {
  icon: string
  style: {
    size?: number
    color?: string
  }
}
export interface AttachmentIcon {
  icon: string
  style: {
    size?: number
    color?: string
  }
}
export interface HyperlinkIcon {
  icon: string
  style: {
    size?: number
    color?: string
  }
}
export interface QuickCreateChildBtnIcon {
  icon: string
  style: {
    size?: number
    color?: string
  }
}
export interface IconListItem {
  name: string
  icon: string
}
export interface IconListGroup {
  name: string
  type: string
  list: IconListItem[]
}
export interface WatermarkConfig {
  onlyExport: boolean
  text: string
  lineSpacing: number
  textSpacing: number
  angle: number
  textStyle: {
    color: string
    opacity: number
    fontSize: number
  }
  belowNode: boolean
}
export interface DragMultiNodeRectConfig {
  width: number
  height: number
  fill: string
}
export interface DragPlaceholderLineConfig {
  color: string
  width: number
}
export interface DragOpacityConfig {
  cloneNodeOpacity: number
  beingDragNodeOpacity: number
}
export interface RainbowLinesConfig {
  open: boolean
  colorsList: string[]
}
export interface PerformanceConfig {
  time: number
  padding: number
  removeNodeWhenOutCanvas: boolean
}
export interface AssociativeLineInitPointsPosition {
  from: string
  to: string
}
export interface DefaultOpt {
  el: HTMLElement | null
  data: unknown
  viewData: unknown
  readonly: boolean
  allowReadonlyContextMenu: boolean
  layout: string
  fishboneDeg: number
  theme: string
  themeConfig: Record<string, unknown>
  scaleRatio: number
  translateRatio: number
  minZoomRatio: number
  maxZoomRatio: number
  customCheckIsTouchPad: ((e: WheelEvent) => boolean) | null
  mouseScaleCenterUseMousePosition: boolean
  maxTag: number
  expandBtnSize: number
  imgTextMargin: number
  textContentMargin: number
  customNoteContentShow: {
    show: () => void
    hide: () => void
  } | null
  textAutoWrapWidth: number
  customHandleMousewheel: ((e: WheelEvent) => void) | null
  mousewheelAction: string
  mousewheelMoveStep: number
  mousewheelZoomActionReverse: boolean
  defaultInsertSecondLevelNodeText: string
  defaultInsertBelowSecondLevelNodeText: string
  expandBtnStyle: ExpandBtnStyle
  expandBtnIcon: ExpandBtnIcon
  expandBtnNumHandler: ((num: number) => string) | null
  isShowExpandNum: boolean
  enableShortcutOnlyWhenMouseInSvg: boolean
  customCheckEnableShortcut: ((e: KeyboardEvent) => boolean) | null
  initRootNodePosition: string | null
  nodeTextEditZIndex: number
  nodeNoteTooltipZIndex: number
  isEndNodeTextEditOnClickOuter: boolean
  maxNodeCount: number
  maxHistoryCount: number
  alwaysShowExpandBtn: boolean
  notShowExpandBtn: boolean
  iconList: IconListGroup[]
  maxNodeCacheCount: number
  fitPadding: number
  enableCtrlKeyNodeSelection: boolean
  useLeftKeySelectionRightKeyDrag: boolean
  beforeTextEdit: ((node: unknown) => boolean | Promise<boolean>) | null
  isUseCustomNodeContent: boolean
  customCreateNodeContent: ((node: unknown) => unknown) | null
  customInnerElsAppendTo: HTMLElement | null
  enableAutoEnterTextEditWhenKeydown: boolean
  autoEmptyTextWhenKeydownEnterEdit: boolean
  customHandleClipboardText: ((text: string) => unknown) | null
  alignSameLevelNodeWidth: boolean
  disableMouseWheelZoom: boolean
  errorHandler: (code: string, error: Error) => void
  enableDblclickBackToRootNode: boolean
  hoverRectColor: string
  hoverRectPadding: number
  selectTextOnEnterEditText: boolean
  deleteNodeActive: boolean
  fit: boolean
  tagsColorMap: Record<string, string>
  cooperateStyle: CooperateStyle
  onlyOneEnableActiveNodeOnCooperate: boolean
  defaultGeneralizationText: string
  handleIsSplitByWrapOnPasteCreateNewNode: (() => Promise<unknown>) | null
  addHistoryTime: number
  isDisableDrag: boolean
  createNewNodeBehavior: string
  defaultNodeImage: string
  isLimitMindMapInCanvas: boolean
  handleNodePasteImg:
    | ((blob: Blob) => Promise<{
        url: string
        size: {
          width: number
          height: number
        }
      }>)
    | null
  customCreateNodePath: ((path: string) => unknown) | null
  customCreateNodePolygon: ((points: number[][]) => unknown) | null
  customTransformNodeLinePath: ((path: string) => string) | null
  beforeShortcutRun: ((key: string, activeNodeList: unknown[]) => boolean | undefined) | null
  resetScaleOnMoveNodeToCenter: boolean
  keyboardNavigationMoveToCenter: boolean
  createNodePrefixContent: ((node: unknown) => unknown) | null
  createNodePostfixContent: ((node: unknown) => unknown) | null
  disabledClipboard: boolean
  customHyperlinkJump: ((link: string, node: unknown) => void) | null
  openPerformance: boolean
  performanceConfig: PerformanceConfig
  emptyTextMeasureHeightText: string
  openRealtimeRenderOnNodeTextEdit: boolean
  mousedownEventPreventDefault: boolean
  onlyPasteTextWhenHasImgAndText: boolean
  enableDragModifyNodeWidth: boolean
  minNodeTextModifyWidth: number
  maxNodeTextModifyWidth: number
  customHandleLine:
    | ((
        node: unknown,
        line: unknown,
        options: {
          width: number
          color: string
          dasharray: string
        }
      ) => void)
    | null
  addHistoryOnInit: boolean
  noteIcon: NoteIcon
  hyperlinkIcon: HyperlinkIcon
  attachmentIcon: AttachmentIcon
  isShowCreateChildBtnIcon: boolean
  quickCreateChildBtnIcon: QuickCreateChildBtnIcon
  customQuickCreateChildBtnClick: ((node: unknown) => void) | null
  addCustomContentToNode: {
    create: (node: unknown) => {
      el: HTMLElement
      width: number
      height: number
    }
    handle: (options: { content: unknown; element: unknown; node: unknown }) => void
  } | null
  enableInheritAncestorLineStyle: boolean
  selectTranslateStep: number
  selectTranslateLimit: number
  enableFreeDrag: boolean
  autoMoveWhenMouseInEdgeOnDrag: boolean
  dragMultiNodeRectConfig: DragMultiNodeRectConfig
  dragPlaceholderRectFill: string
  dragPlaceholderLineConfig: DragPlaceholderLineConfig
  dragOpacityConfig: DragOpacityConfig
  handleDragCloneNode: ((cloneNode: unknown) => void) | null
  beforeDragEnd:
    | ((info: {
        overlapNodeUid: string
        prevNodeUid: string
        nextNodeUid: string
      }) => boolean | Promise<boolean> | undefined)
    | null
  beforeDragStart: ((nodeList: unknown[]) => boolean | undefined) | null
  watermarkConfig: WatermarkConfig
  exportPaddingX: number
  exportPaddingY: number
  resetCss: string
  minExportImgCanvasScale: number
  addContentToHeader:
    | (() => {
        el: HTMLElement
        cssText?: string
        height: number
      } | null)
    | null
  addContentToFooter:
    | (() => {
        el: HTMLElement
        cssText?: string
        height: number
      } | null)
    | null
  handleBeingExportSvg: ((svg: unknown) => unknown) | null
  maxCanvasSize: number
  defaultAssociativeLineText: string
  associativeLineIsAlwaysAboveNode: boolean
  associativeLineInitPointsPosition: AssociativeLineInitPointsPosition
  enableAdjustAssociativeLinePoints: boolean
  beforeAssociativeLineConnection: ((node: unknown) => boolean | undefined) | null
  disableTouchZoom: boolean
  minTouchZoomScale: number
  maxTouchZoomScale: number
  isLimitMindMapInCanvasWhenHasScrollbar: boolean
  isOnlySearchCurrentRenderNodes: boolean
  beforeCooperateUpdate: ((info: { type: string; data: unknown }) => void) | null
  rainbowLinesConfig: RainbowLinesConfig
  demonstrateConfig: unknown
  enableEditFormulaInRichTextEdit: boolean
  katexFontPath: string
  getKatexOutputType: (() => string) | null
  transformRichTextOnEnterEdit: ((content: string) => string) | null
  beforeHideRichTextEdit: ((richTextInstance: unknown) => void) | null
  outerFramePaddingX: number
  outerFramePaddingY: number
  defaultOuterFrameText: string
  onlyPainterNodeCustomStyles: boolean
  beforeDeleteNodeImg: (() => boolean | undefined) | null
  imgResizeBtnSize: number
  minImgResizeWidth: number
  minImgResizeHeight: number
  maxImgResizeWidthInheritTheme: boolean
  maxImgResizeWidth: number
  maxImgResizeHeight: number
  customDeleteBtnInnerHTML: string
  customResizeBtnInnerHTML: string
}
export declare const defaultOpt: {
  el: any
  data: any
  viewData: any
  readonly: false
  allowReadonlyContextMenu: false
  layout: 'logicalStructure'
  fishboneDeg: number
  theme: string
  themeConfig: {}
  scaleRatio: number
  translateRatio: number
  minZoomRatio: number
  maxZoomRatio: number
  customCheckIsTouchPad: any
  mouseScaleCenterUseMousePosition: true
  maxTag: number
  expandBtnSize: number
  imgTextMargin: number
  textContentMargin: number
  customNoteContentShow: any
  textAutoWrapWidth: number
  customHandleMousewheel: any
  mousewheelAction: 'move'
  mousewheelMoveStep: number
  mousewheelZoomActionReverse: true
  defaultInsertSecondLevelNodeText: string
  defaultInsertBelowSecondLevelNodeText: string
  expandBtnStyle: {
    color: string
    fill: string
    fontSize: number
    strokeColor: string
  }
  expandBtnIcon: {
    open: string
    close: string
  }
  expandBtnNumHandler: any
  isShowExpandNum: true
  enableShortcutOnlyWhenMouseInSvg: true
  customCheckEnableShortcut: any
  initRootNodePosition: any
  nodeTextEditZIndex: number
  nodeNoteTooltipZIndex: number
  isEndNodeTextEditOnClickOuter: true
  maxNodeCount: number
  maxHistoryCount: number
  alwaysShowExpandBtn: false
  notShowExpandBtn: false
  iconList: any[]
  maxNodeCacheCount: number
  fitPadding: number
  enableCtrlKeyNodeSelection: true
  useLeftKeySelectionRightKeyDrag: false
  beforeTextEdit: any
  isUseCustomNodeContent: false
  customCreateNodeContent: any
  customInnerElsAppendTo: any
  enableAutoEnterTextEditWhenKeydown: false
  autoEmptyTextWhenKeydownEnterEdit: false
  customHandleClipboardText: any
  alignSameLevelNodeWidth: false
  disableMouseWheelZoom: false
  errorHandler: (code: string, error: Error) => void
  enableDblclickBackToRootNode: false
  hoverRectColor: string
  hoverRectPadding: number
  selectTextOnEnterEditText: false
  deleteNodeActive: true
  fit: false
  tagsColorMap: {}
  cooperateStyle: {
    avatarSize: number
    fontSize: number
    overlapRatio: number
    chipWidth: number
    chipGap: number
  }
  onlyOneEnableActiveNodeOnCooperate: false
  defaultGeneralizationText: string
  handleIsSplitByWrapOnPasteCreateNewNode: any
  addHistoryTime: number
  isDisableDrag: false
  createNewNodeBehavior: 'default'
  defaultNodeImage: string
  isLimitMindMapInCanvas: false
  handleNodePasteImg: any
  customCreateNodePath: any
  customCreateNodePolygon: any
  customTransformNodeLinePath: any
  beforeShortcutRun: any
  resetScaleOnMoveNodeToCenter: false
  keyboardNavigationMoveToCenter: false
  createNodePrefixContent: any
  createNodePostfixContent: any
  disabledClipboard: false
  customHyperlinkJump: any
  openPerformance: false
  performanceConfig: {
    time: number
    padding: number
    removeNodeWhenOutCanvas: true
  }
  emptyTextMeasureHeightText: string
  openRealtimeRenderOnNodeTextEdit: false
  mousedownEventPreventDefault: false
  onlyPasteTextWhenHasImgAndText: true
  enableDragModifyNodeWidth: true
  minNodeTextModifyWidth: number
  maxNodeTextModifyWidth: number
  customHandleLine: any
  addHistoryOnInit: true
  noteIcon: {
    icon: string
    style: {}
  }
  hyperlinkIcon: {
    icon: string
    style: {}
  }
  attachmentIcon: {
    icon: string
    style: {}
  }
  isShowCreateChildBtnIcon: true
  quickCreateChildBtnIcon: {
    icon: string
    style: {}
  }
  customQuickCreateChildBtnClick: any
  addCustomContentToNode: any
  enableInheritAncestorLineStyle: true
  selectTranslateStep: number
  selectTranslateLimit: number
  enableFreeDrag: false
  autoMoveWhenMouseInEdgeOnDrag: true
  dragMultiNodeRectConfig: {
    width: number
    height: number
    fill: string
  }
  dragPlaceholderRectFill: string
  dragPlaceholderLineConfig: {
    color: string
    width: number
  }
  dragOpacityConfig: {
    cloneNodeOpacity: number
    beingDragNodeOpacity: number
  }
  handleDragCloneNode: any
  beforeDragEnd: any
  beforeDragStart: any
  watermarkConfig: {
    onlyExport: false
    text: string
    lineSpacing: number
    textSpacing: number
    angle: number
    textStyle: {
      color: string
      opacity: number
      fontSize: number
    }
    belowNode: false
  }
  exportPaddingX: number
  exportPaddingY: number
  resetCss: string
  minExportImgCanvasScale: number
  addContentToHeader: any
  addContentToFooter: any
  handleBeingExportSvg: any
  maxCanvasSize: number
  defaultAssociativeLineText: string
  associativeLineIsAlwaysAboveNode: true
  associativeLineInitPointsPosition: {
    from: string
    to: string
  }
  enableAdjustAssociativeLinePoints: true
  beforeAssociativeLineConnection: any
  disableTouchZoom: false
  minTouchZoomScale: number
  maxTouchZoomScale: number
  isLimitMindMapInCanvasWhenHasScrollbar: true
  isOnlySearchCurrentRenderNodes: false
  beforeCooperateUpdate: any
  rainbowLinesConfig: {
    open: false
    colorsList: string[]
  }
  demonstrateConfig: any
  enableEditFormulaInRichTextEdit: true
  katexFontPath: string
  getKatexOutputType: any
  transformRichTextOnEnterEdit: any
  beforeHideRichTextEdit: any
  outerFramePaddingX: number
  outerFramePaddingY: number
  defaultOuterFrameText: string
  onlyPainterNodeCustomStyles: false
  beforeDeleteNodeImg: any
  imgResizeBtnSize: number
  minImgResizeWidth: number
  minImgResizeHeight: number
  maxImgResizeWidthInheritTheme: false
  maxImgResizeWidth: number
  maxImgResizeHeight: number
  customDeleteBtnInnerHTML: string
  customResizeBtnInnerHTML: string
}
