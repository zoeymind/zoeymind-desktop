import MindMapNode from '../core/render/node/MindMapNode'
import Lru from '../utils/Lru'
import type { G } from '@svgdotjs/svg.js'
import type Render from '../core/render/Render'
import type { default as MindMapInstance } from '../index'
declare class Base {
  renderer: Render
  mindMap: MindMapInstance
  draw: G
  lineDraw: G
  root: MindMapNode | null
  lru: Lru
  rootNodeCenterOffset: {
    x: number
    y: number
  } | null
  isUseLeft?: boolean
  constructor(renderer: any)
  doLayout(callback?: any): void
  afterComputedBaseValue(): void
  renderLine(node?: any, lines?: any, style?: any, lineStyle?: any): void
  renderExpandBtn(node?: any, btn?: any): void
  renderGeneralization(list?: any): void
  cacheNode(uid: any, node: any): void
  checkIsNeedResizeSources(): boolean
  checkIsLayerTypeChange(oldIndex: any, newIndex: any): boolean
  checkIsLayoutChangeRerenderExpandBtnPlaceholderRect(node: any): void
  checkIsNodeDataChange(lastData: any, curData: any): boolean
  checkNodeFixChange(newNode: any, nodeInnerPrefixData: any, nodeInnerPostfixData: any): boolean
  createNode(data: any, parent: any, isRoot: any, layerIndex: any, index: any, ancestors: any): any
  checkGetGeneralizationChange(node: any, isResizeSource: any): void
  formatPosition(value: any, size: any, nodeSize: any): number
  formatInitRootNodePosition(pos: any): any
  setNodeCenter(node: any, position?: any): void
  getRootCenterOffset(
    width: any,
    height: any
  ): {
    x: number
    y: number
  }
  updateChildren(children: any, prop: any, offset: any): void
  updateChildrenPro(children: any, props: any): void
  getNodeAreaWidth(node: any, withGeneralization?: boolean): number
  quadraticCurvePath(x1: any, y1: any, x2: any, y2: any, v?: boolean): string
  cubicBezierPath(x1: any, y1: any, x2: any, y2: any, v?: boolean): string
  computeNewPoint(a: any, b: any, radius?: number): any[]
  createFoldLine(list: any): string
  getMarginX(layerIndex: any): number
  getMarginY(layerIndex: any): number
  getNodeWidthWithGeneralization(node: any): number
  getNodeHeightWithGeneralization(node: any): number
  /**
   * dir：生长方向，h（水平）、v（垂直）
   * isLeft：是否向左生长
   */
  getNodeBoundaries(
    node: any,
    dir: any
  ): {
    left: any
    right: any
    top: any
    bottom: any
    generalizationLineMargin: unknown
    generalizationNodeMargin: unknown
  }
  getChildrenBoundaries(
    node: any,
    dir: any,
    startIndex: number,
    endIndex: any
  ): {
    left: number
    right: number
    top: number
    bottom: number
    generalizationLineMargin: unknown
    generalizationNodeMargin: unknown
  }
  getNodeGeneralizationRenderBoundaries(item: any, dir: any): any
  alignSameLevelNodeWidth(): void
  getNodeActChildrenLength(node: any): any
  setLineStyle(style: any, line: any, path: any, childNode: any): void
  transformPath(path: any): any
}
export default Base
