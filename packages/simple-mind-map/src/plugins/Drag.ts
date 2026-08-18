// @ts-nocheck — vendored engine source
import {
  bfsWalk,
  throttle,
  getTopAncestorsFomNodeList,
  getNodeIndexInNodeList,
  sortNodeList
} from '../utils'
import Base from '../layouts/Base'
import { CONSTANTS } from '../constants/constant'

import type MindMapNode from '../core/render/node/MindMapNode'
import AutoMove from '../utils/AutoMove'
interface SVGEl {
  remove(): void
  size(w: number, h: number): SVGEl
  hide(): SVGEl
  show(): SVGEl
  opacity(val: number): SVGEl
  css(prop: string, val: string | number): SVGEl
  fill(val: Record<string, unknown> | string): SVGEl
  stroke(val: Record<string, unknown>): SVGEl
  findOne(selector: string): SVGEl | null
  addClass(cls: string): void
  removeClass(cls: string): void
  radius?(r: number): SVGEl
  transform(): { translateX: number; translateY: number }
  translate(x: number, y: number): void
  move(x: number, y: number): SVGEl
  clone(): SVGEl
  plot?(points: number[][]): void
}

// 节点拖动插件
class Drag extends Base {
  declare static instanceName: string
  declare autoMove: AutoMove
  declare isDragging: boolean
  declare mousedownNode: MindMapNode | null
  declare beingDragNodeList: MindMapNode[]
  declare nodeList: MindMapNode[]
  declare overlapNode: MindMapNode | null
  declare prevNode: MindMapNode | null
  declare nextNode: MindMapNode | null
  declare drawTransform: {
    scaleX: number
    scaleY: number
    translateX: number
    translateY: number
  } | null
  declare clone: SVGEl | null
  declare placeholder: SVGEl | null
  declare placeholderWidth: number
  declare placeholderHeight: number
  declare placeHolderLine: SVGEl | null
  declare placeHolderExtraLines: SVGEl[]
  declare offsetX: number
  declare offsetY: number
  declare isMousedown: boolean
  declare mouseDownX: number
  declare mouseDownY: number
  declare mouseMoveX: number
  declare mouseMoveY: number
  declare checkDragOffset: number
  declare minOffset: number
  declare horizontalIndicator: SVGEl | null
  //  构造函数
  constructor({ mindMap }) {
    super(mindMap.renderer)
    this.mindMap = mindMap
    this.autoMove = new AutoMove(mindMap)
    this.reset()
    this.bindEvent()
  }

  //  复位
  reset() {
    // 是否正在拖拽中
    this.isDragging = false
    // 鼠标按下的节点
    this.mousedownNode = null
    // 被拖拽中的节点列表
    this.beingDragNodeList = []
    // 当前画布节点列表
    this.nodeList = []
    // 当前重叠节点
    this.overlapNode = null
    // 当前上一个同级节点
    this.prevNode = null
    // 当前下一个同级节点
    this.nextNode = null
    // 画布的变换数据
    this.drawTransform = null
    // 克隆节点
    this.clone = null
    // 同级位置占位符
    this.placeholder = null
    this.placeholderWidth = 50
    this.placeholderHeight = 24
    this.placeHolderLine = null
    this.placeHolderExtraLines = []
    // 鼠标按下位置和节点左上角的偏移量
    this.offsetX = 0
    this.offsetY = 0
    // 当前鼠标是否按下
    this.isMousedown = false
    // 拖拽的鼠标位置变量
    this.mouseDownX = 0
    this.mouseDownY = 0
    this.mouseMoveX = 0
    this.mouseMoveY = 0
    // 鼠标移动的距离距鼠标按下的位置距离多少以上才认为是拖动事件
    this.checkDragOffset = 10
    this.minOffset = 10
  }

  //  绑定事件
  bindEvent() {
    this.onNodeMousedown = this.onNodeMousedown.bind(this)
    this.onMousemove = this.onMousemove.bind(this)
    this.onMouseup = this.onMouseup.bind(this)
    this.checkOverlapNode = throttle(this.checkOverlapNode, 100, this) // 优化：减少节流延迟从300ms到100ms，提升响应速度

    this.mindMap.on('node_mousedown', this.onNodeMousedown)
    this.mindMap.on('mousemove', this.onMousemove)
    this.mindMap.on('node_mouseup', this.onMouseup)
    this.mindMap.on('mouseup', this.onMouseup)
  }

  // 解绑事件
  unBindEvent() {
    this.mindMap.off('node_mousedown', this.onNodeMousedown)
    this.mindMap.off('mousemove', this.onMousemove)
    this.mindMap.off('node_mouseup', this.onMouseup)
    this.mindMap.off('mouseup', this.onMouseup)
  }

  // 节点鼠标按下事件
  onNodeMousedown(node, e) {
    // 只读模式、不是鼠标左键按下、按下的是概要节点或根节点直接返回
    if (this.mindMap.opt.readonly || e.which !== 1 || node.isGeneralization || node.isRoot) {
      return
    }
    this.isMousedown = true
    // 记录鼠标按下时的节点
    this.mousedownNode = node
    // 记录鼠标按下的坐标
    const { x, y } = this.mindMap.toPos(e.clientX, e.clientY)
    this.mouseDownX = x
    this.mouseDownY = y
  }

  // 鼠标移动事件
  onMousemove(e) {
    if (this.mindMap.opt.readonly || !this.isMousedown) {
      return
    }
    e.preventDefault()
    const { x, y } = this.mindMap.toPos(e.clientX, e.clientY)
    this.mouseMoveX = x
    this.mouseMoveY = y
    // 还没开始移动时鼠标位移过小不认为是拖拽
    if (
      !this.isDragging &&
      Math.abs(x - this.mouseDownX) <= this.checkDragOffset &&
      Math.abs(y - this.mouseDownY) <= this.checkDragOffset
    ) {
      return
    }
    this.mindMap.emit('node_dragging', this.mousedownNode)
    this.handleStartMove()
    this.onMove(x, y, e)
  }

  //  鼠标松开事件
  async onMouseup(e) {
    if (!this.isMousedown) {
      return
    }
    const { autoMoveWhenMouseInEdgeOnDrag, enableFreeDrag, beforeDragEnd } = this.mindMap.opt
    // 停止自动移动
    if (autoMoveWhenMouseInEdgeOnDrag && (this.mindMap as unknown as { select: unknown }).select) {
      this.autoMove.clearAutoMoveTimer()
    }
    this.isMousedown = false
    // 恢复被拖拽节点的临时设置
    this.beingDragNodeList.forEach(node => {
      node.setOpacity(1)
      node.showChildren()
      node.endDrag()
    })
    this.removeCloneNode()
    let overlapNodeUid = this.overlapNode ? this.overlapNode.getData('uid') : ''
    let prevNodeUid = this.prevNode ? this.prevNode.getData('uid') : ''
    let nextNodeUid = this.nextNode ? this.nextNode.getData('uid') : ''
    if (this.isDragging && typeof beforeDragEnd === 'function') {
      const isCancel = await beforeDragEnd({
        overlapNodeUid,
        prevNodeUid,
        nextNodeUid,
        beingDragNodeList: [...this.beingDragNodeList]
      })
      if (isCancel) {
        this.reset()
        return
      }
    }
    // 存在重叠子节点，则移动作为其子节点
    if (this.overlapNode) {
      this.removeNodeActive(this.overlapNode)
      this.mindMap.execCommand('MOVE_NODE_TO', this.beingDragNodeList, this.overlapNode)
      // 激活被拖拽的节点
      this.activateDraggedNodes()
    } else if (this.prevNode) {
      // 存在前一个相邻节点，作为其下一个兄弟节点
      this.removeNodeActive(this.prevNode)
      this.mindMap.execCommand('INSERT_AFTER', this.beingDragNodeList, this.prevNode)
      // 激活被拖拽的节点
      this.activateDraggedNodes()
    } else if (this.nextNode) {
      // 存在下一个相邻节点，作为其前一个兄弟节点
      this.removeNodeActive(this.nextNode)
      this.mindMap.execCommand('INSERT_BEFORE', this.beingDragNodeList, this.nextNode)
      // 激活被拖拽的节点
      this.activateDraggedNodes()
    } else if (this.clone && enableFreeDrag && this.beingDragNodeList.length === 1) {
      // 如果只拖拽了一个节点，那么设置自定义位置
      let { x, y } = this.mindMap.toPos(e.clientX - this.offsetX, e.clientY - this.offsetY)
      let { scaleX, scaleY, translateX, translateY } = this.drawTransform
      x = (x - translateX) / scaleX
      y = (y - translateY) / scaleY
      this.mousedownNode.left = x
      this.mousedownNode.top = y
      this.mousedownNode.customLeft = x
      this.mousedownNode.customTop = y
      this.mindMap.execCommand('SET_NODE_CUSTOM_POSITION', this.mousedownNode, x, y)
      this.mindMap.render()
      // 激活被拖拽的节点
      this.activateDraggedNodes()
    }
    if (this.isDragging) {
      this.mindMap.emit('node_dragend', {
        overlapNodeUid,
        prevNodeUid,
        nextNodeUid
      })
    }
    this.reset()
  }

  // 移除节点的激活状态
  removeNodeActive(node) {
    if (node.getData('isActive')) {
      this.mindMap.execCommand('SET_NODE_ACTIVE', node, false)
    }
  }

  // 激活被拖拽的节点
  activateDraggedNodes() {
    // 清除当前所有激活的节点，然后激活被拖拽的节点
    this.mindMap.execCommand('CLEAR_ACTIVE_NODE')
    // 激活所有被拖拽的节点
    this.beingDragNodeList.forEach(node => {
      this.mindMap.execCommand('SET_NODE_ACTIVE', node, true)
    })
  }

  //  拖动中
  onMove(x, y, e) {
    if (!this.isMousedown || !this.isDragging) {
      return
    }
    // 更新克隆节点的位置
    let { scaleX, scaleY, translateX, translateY } = this.drawTransform
    let cloneNodeLeft = x - this.offsetX
    let cloneNodeTop = y - this.offsetY
    x = (cloneNodeLeft - translateX) / scaleX
    y = (cloneNodeTop - translateY) / scaleY
    let t = this.clone.transform()
    this.clone.translate(x - t.translateX, y - t.translateY)
    // 检测新位置
    this.checkOverlapNode()
    // 边缘自动移动画布
    this.drawTransform = this.mindMap.draw.transform() as unknown as {
      scaleX: number
      scaleY: number
      translateX: number
      translateY: number
    }
    this.autoMove.clearAutoMoveTimer()
    this.autoMove.onMove(e.clientX, e.clientY)
  }

  // 开始拖拽时初始化一些数据
  async handleStartMove() {
    if (!this.isDragging) {
      // 鼠标按下的节点
      let node = this.mousedownNode
      // 计算鼠标按下的位置距离节点左上角的距离
      this.drawTransform = this.mindMap.draw.transform() as unknown as {
        scaleX: number
        scaleY: number
        translateX: number
        translateY: number
      }
      let { scaleX, scaleY, translateX, translateY } = this.drawTransform
      this.offsetX = this.mouseDownX - (node.left * scaleX + translateX)
      this.offsetY = this.mouseDownY - (node.top * scaleY + translateY)
      // 如果鼠标按下的节点是激活节点，那么保存当前所有激活的节点
      if (node.getData('isActive')) {
        // 找出这些激活节点中的最顶层节点
        // 并按索引从小到大排序
        this.beingDragNodeList = sortNodeList(
          getTopAncestorsFomNodeList(
            // 过滤掉根节点和概要节点
            this.mindMap.renderer.activeNodeList.filter(item => {
              return !item.isRoot && !item.isGeneralization
            })
          )
        )
      } else {
        // 如果按下的节点不是激活节点，先激活它，然后拖拽
        this.mindMap.execCommand('SET_NODE_ACTIVE', node, true)
        this.beingDragNodeList = [node]
      }
      // 拦截拖拽
      const { beforeDragStart } = this.mindMap.opt
      if (typeof beforeDragStart === 'function') {
        const stop = await beforeDragStart([...this.beingDragNodeList])
        if (stop) return
      }
      // 将节点树转为节点数组
      this.nodeTreeToList()
      // 创建克隆节点
      this.createCloneNode()
      // 拖拽时保持原节点的激活状态，不清除激活节点
      this.isDragging = true
    }
  }

  // 节点由树转换成数组，优先同级节点检测
  nodeTreeToList() {
    const list = []
    bfsWalk(this.mindMap.renderer.root, node => {
      // 过滤掉当前被拖拽的节点
      if (this.checkIsInBeingDragNodeList(node)) {
        return
      }
      if (!list[node.layerIndex]) {
        list[node.layerIndex] = []
      }
      list[node.layerIndex].push(node)
    })
    // 优化：按层级从浅到深排序，同级节点优先于跨父节点检测
    this.nodeList = list.reduce((res, cur) => {
      return [...res, ...cur]
    }, [])
  }

  //  创建克隆节点
  createCloneNode() {
    if (!this.clone) {
      const {
        dragMultiNodeRectConfig,
        dragPlaceholderRectFill,
        dragPlaceholderLineConfig,
        dragOpacityConfig,
        handleDragCloneNode
      } = this.mindMap.opt
      const {
        width: rectWidth,
        height: rectHeight,
        fill: rectFill
      } = dragMultiNodeRectConfig as { width: number; height: number; fill: string }
      const node = this.beingDragNodeList[0]
      const lineColor = node.style.merge('lineColor', true)
      // 如果当前被拖拽的节点数量大于1，那么创建一个矩形示意
      if (this.beingDragNodeList.length > 1) {
        this.clone = (this.mindMap.otherDraw.rect() as unknown as SVGEl)
          .size(rectWidth, rectHeight)
          .radius(rectHeight / 2)
          .fill({
            color: rectFill || lineColor
          })
        this.offsetX = rectWidth / 2
        this.offsetY = rectHeight / 2
      } else {
        // 否则克隆当前的节点
        this.clone = node.group.clone() as unknown as SVGEl
        // 删除展开收起按钮元素
        const expandEl = this.clone.findOne('.smm-expand-btn')
        if (expandEl) {
          expandEl.remove()
        }
        // 删除选择框元素，确保幽灵节点只包含节点卡片
        const hoverEl = this.clone.findOne('.smm-hover-node')
        if (hoverEl) {
          hoverEl.remove()
        }
        // 移除active类，确保不显示选择框样式
        ;(this.clone as unknown as SVGEl).removeClass('active')
        ;(this.mindMap.otherDraw as unknown as { add(el: unknown): void }).add(this.clone)
        if (typeof handleDragCloneNode === 'function') {
          handleDragCloneNode(this.clone)
        }
      }
      this.clone.opacity(
        (dragOpacityConfig as { cloneNodeOpacity: number; beingDragNodeOpacity: number })
          .cloneNodeOpacity
      )
      this.clone.css('z-index', 99999)
      // 同级位置提示元素
      this.placeholder = (this.mindMap.otherDraw.rect() as unknown as SVGEl)
        .fill({
          color: dragPlaceholderRectFill || lineColor
        })
        .radius(5)
      this.placeHolderLine = (this.mindMap.otherDraw.path() as unknown as SVGEl)
        .stroke({
          color: (dragPlaceholderLineConfig as { color: string; width: number }).color || lineColor,
          width: (dragPlaceholderLineConfig as { color: string; width: number }).width
        })
        .fill({ color: 'none' })
      // 添加横向分割线指示器，用于显示节点内部的上下分割
      this.horizontalIndicator = (this.mindMap.otherDraw.line() as unknown as SVGEl)
        .stroke({
          color: (dragPlaceholderLineConfig as { color: string; width: number }).color || lineColor,
          width: 2
        })
        .hide()
      // 当前被拖拽的节点的临时设置
      this.beingDragNodeList.forEach(node => {
        // 降低透明度
        node.setOpacity(
          (dragOpacityConfig as { cloneNodeOpacity: number; beingDragNodeOpacity: number })
            .beingDragNodeOpacity
        )
      })
    }
  }

  //  移除克隆节点
  removeCloneNode() {
    if (!this.clone) {
      return
    }
    this.clone.remove()
    this.placeholder.remove()
    this.placeHolderLine.remove()
    if (this.horizontalIndicator) {
      this.horizontalIndicator.remove()
    }
    this.removeExtraLines()
  }

  // 移除额外创建的连线
  removeExtraLines() {
    this.placeHolderExtraLines.forEach(item => {
      item.remove()
    })
    this.placeHolderExtraLines = []
  }

  //  检测重叠节点
  checkOverlapNode() {
    if (!this.drawTransform || !this.placeholder) {
      return
    }
    const {
      LOGICAL_STRUCTURE,
      LOGICAL_STRUCTURE_LEFT,
      MIND_MAP,
      ORGANIZATION_STRUCTURE,
      CATALOG_ORGANIZATION,
      TIMELINE,
      TIMELINE2,
      VERTICAL_TIMELINE,
      VERTICAL_TIMELINE2,
      VERTICAL_TIMELINE3,
      FISHBONE,
      FISHBONE2,
      RIGHT_FISHBONE,
      RIGHT_FISHBONE2
    } = CONSTANTS.LAYOUT
    this.overlapNode = null
    this.prevNode = null
    this.nextNode = null
    this.placeholder.size(0, 0)
    this.placeHolderLine.hide()
    if (this.horizontalIndicator) {
      this.horizontalIndicator.hide()
    }
    this.removeExtraLines()
    // 优化：优先检测同父节点，再检测跨父节点
    const draggedNodeParent = this.beingDragNodeList[0]?.parent

    // 第一轮：只检测与被拖拽节点同父的节点
    if (draggedNodeParent) {
      this.nodeList.forEach(node => {
        if (node.getData('isActive')) {
          this.mindMap.execCommand('SET_NODE_ACTIVE', node, false)
        }
        // 只检测同父节点
        if (node.parent !== draggedNodeParent) {
          return
        }
        if (this.overlapNode || (this.prevNode && this.nextNode)) {
          return
        }
        this.handleNodeByLayout(node)
      })
    }

    // 第二轮：如果没有找到同父节点的插入位置，再检测其他节点
    if (!this.overlapNode && !this.prevNode && !this.nextNode) {
      this.nodeList.forEach(node => {
        // 跳过同父节点（第一轮已检测）
        if (draggedNodeParent && node.parent === draggedNodeParent) {
          return
        }
        if (this.overlapNode || (this.prevNode && this.nextNode)) {
          return
        }
        this.handleNodeByLayout(node)
      })
    }
    // 重叠节点，也就是添加为子节点
    if (this.overlapNode) {
      this.handleOverlapNode()
    }
  }

  // 根据布局类型处理节点检测
  handleNodeByLayout(node) {
    switch (this.mindMap.opt.layout) {
      case CONSTANTS.LAYOUT.LOGICAL_STRUCTURE:
      case CONSTANTS.LAYOUT.LOGICAL_STRUCTURE_LEFT:
        this.handleLogicalStructure(node)
        break
      case CONSTANTS.LAYOUT.MIND_MAP:
        this.handleMindMap(node)
        break
      case CONSTANTS.LAYOUT.ORGANIZATION_STRUCTURE:
        this.handleOrganizationStructure(node)
        break
      case CONSTANTS.LAYOUT.CATALOG_ORGANIZATION:
        this.handleCatalogOrganization(node)
        break
      case CONSTANTS.LAYOUT.TIMELINE:
        this.handleTimeLine(node)
        break
      case CONSTANTS.LAYOUT.TIMELINE2:
        this.handleTimeLine2(node)
        break
      case CONSTANTS.LAYOUT.VERTICAL_TIMELINE:
      case CONSTANTS.LAYOUT.VERTICAL_TIMELINE2:
      case CONSTANTS.LAYOUT.VERTICAL_TIMELINE3:
        this.handleLogicalStructure(node)
        break
      case CONSTANTS.LAYOUT.FISHBONE:
      case CONSTANTS.LAYOUT.FISHBONE2:
      case CONSTANTS.LAYOUT.RIGHT_FISHBONE:
      case CONSTANTS.LAYOUT.RIGHT_FISHBONE2:
        this.handleFishbone(node)
        break
      default:
        this.handleLogicalStructure(node)
    }
  }

  // 处理作为子节点的情况
  handleOverlapNode() {
    const {
      LOGICAL_STRUCTURE,
      LOGICAL_STRUCTURE_LEFT,
      MIND_MAP,
      ORGANIZATION_STRUCTURE,
      CATALOG_ORGANIZATION,
      TIMELINE,
      TIMELINE2,
      VERTICAL_TIMELINE,
      VERTICAL_TIMELINE2,
      VERTICAL_TIMELINE3,
      FISHBONE,
      FISHBONE2,
      RIGHT_FISHBONE,
      RIGHT_FISHBONE2
    } = CONSTANTS.LAYOUT
    const { LEFT, TOP, RIGHT, BOTTOM } = CONSTANTS.LAYOUT_GROW_DIR
    const layerIndex = this.overlapNode.layerIndex
    const children = this.overlapNode.children
    const marginX = this.mindMap.renderer.layout.getMarginX(layerIndex + 1)
    const marginY = this.mindMap.renderer.layout.getMarginY(layerIndex + 1)
    const halfPlaceholderWidth = this.placeholderWidth / 2
    const halfPlaceholderHeight = this.placeholderHeight / 2
    let dir = ''
    let x = 0
    let y = 0
    let rotate = false
    let notRenderPlaceholder = false
    // 目标节点存在子节点，那么基于最后一个子节点定位
    if (children.length > 0) {
      const lastChild = children[children.length - 1]
      const lastNodeRect = this.getNodeRect(lastChild)
      dir = this.getNewChildNodeDir(lastChild)
      switch (this.mindMap.opt.layout) {
        case LOGICAL_STRUCTURE:
        case MIND_MAP:
          x =
            dir === LEFT
              ? lastNodeRect.originRight - this.placeholderWidth
              : lastNodeRect.originLeft
          y = lastNodeRect.originBottom + this.minOffset - halfPlaceholderHeight
          break
        case LOGICAL_STRUCTURE_LEFT:
          x = lastNodeRect.originRight - this.placeholderWidth
          y = lastNodeRect.originBottom + this.minOffset - halfPlaceholderHeight
          break
        case ORGANIZATION_STRUCTURE:
          rotate = true
          x = lastNodeRect.originRight + this.minOffset - halfPlaceholderHeight
          y = lastNodeRect.originTop
          break
        case CATALOG_ORGANIZATION:
          if (layerIndex === 0) {
            rotate = true
            x = lastNodeRect.originRight + this.minOffset - halfPlaceholderHeight
            y = lastNodeRect.originTop
          } else {
            x = lastNodeRect.originLeft
            y = lastNodeRect.originBottom + this.minOffset - halfPlaceholderHeight
          }
          break
        case TIMELINE:
          if (layerIndex === 0) {
            rotate = true
            x = lastNodeRect.originRight + this.minOffset - halfPlaceholderHeight
            y = lastNodeRect.originTop + lastNodeRect.originHeight / 2 - halfPlaceholderWidth
          } else {
            x = lastNodeRect.originLeft
            y = lastNodeRect.originBottom + this.minOffset - halfPlaceholderHeight
          }
          break
        case TIMELINE2:
          if (layerIndex === 0) {
            rotate = true
            x = lastNodeRect.originRight + this.minOffset - halfPlaceholderHeight
            y = lastNodeRect.originTop + lastNodeRect.originHeight / 2 - halfPlaceholderWidth
          } else {
            x = lastNodeRect.originLeft
            if (layerIndex === 1) {
              y =
                dir === TOP
                  ? lastNodeRect.originTop -
                    this.placeholderHeight -
                    this.minOffset +
                    halfPlaceholderHeight
                  : lastNodeRect.originBottom + this.minOffset - halfPlaceholderHeight
            } else {
              y = lastNodeRect.originBottom + this.minOffset - halfPlaceholderHeight
            }
          }
          break
        case VERTICAL_TIMELINE:
        case VERTICAL_TIMELINE2:
        case VERTICAL_TIMELINE3:
          if (layerIndex === 0) {
            x = lastNodeRect.originLeft + lastNodeRect.originWidth / 2 - halfPlaceholderWidth
            y = lastNodeRect.originBottom + this.minOffset - halfPlaceholderHeight
          } else {
            x =
              dir === RIGHT
                ? lastNodeRect.originLeft
                : lastNodeRect.originRight - this.placeholderWidth
            y = lastNodeRect.originBottom + this.minOffset - halfPlaceholderHeight
          }
          break
        case FISHBONE:
        case FISHBONE2:
        case RIGHT_FISHBONE:
        case RIGHT_FISHBONE2:
          if (layerIndex <= 1) {
            notRenderPlaceholder = true
            this.mindMap.execCommand('SET_NODE_ACTIVE', this.overlapNode, true)
          } else {
            x = lastNodeRect.originLeft
            y =
              dir === TOP
                ? lastNodeRect.originBottom + this.minOffset - halfPlaceholderHeight
                : lastNodeRect.originTop -
                  this.placeholderHeight -
                  this.minOffset +
                  halfPlaceholderHeight
          }
          break
        default:
      }
    } else {
      // 目标节点不存在子节点，那么基于目标节点定位
      const nodeRect = this.getNodeRect(this.overlapNode)
      dir = this.getNewChildNodeDir(this.overlapNode)
      switch (this.mindMap.opt.layout) {
        case LOGICAL_STRUCTURE:
        case MIND_MAP:
          x =
            dir === RIGHT
              ? nodeRect.originRight + marginX
              : nodeRect.originLeft - this.placeholderWidth - marginX
          y = nodeRect.originTop + (nodeRect.originHeight - this.placeholderHeight) / 2
          break
        case LOGICAL_STRUCTURE_LEFT:
          x = nodeRect.originLeft - this.placeholderWidth - marginX
          y = nodeRect.originTop + (nodeRect.originHeight - this.placeholderHeight) / 2
          break
        case ORGANIZATION_STRUCTURE:
          rotate = true
          x = nodeRect.originLeft + (nodeRect.originWidth - this.placeholderHeight) / 2
          y = nodeRect.originBottom + marginX
          break
        case CATALOG_ORGANIZATION:
          if (layerIndex === 0) {
            rotate = true
          }
          x = nodeRect.originLeft + nodeRect.originWidth * 0.5
          y = nodeRect.originBottom + marginX
          break
        case TIMELINE:
          if (layerIndex === 0) {
            rotate = true
          }
          x = nodeRect.originLeft + nodeRect.originWidth * 0.5
          y = nodeRect.originBottom + marginY
          break
        case TIMELINE2:
          if (layerIndex === 0) {
            rotate = true
          }
          x = nodeRect.originLeft + nodeRect.originWidth * 0.5
          if (layerIndex === 1) {
            y =
              dir === TOP
                ? nodeRect.originTop - this.placeholderHeight - marginX
                : nodeRect.originBottom + marginX
          } else {
            y = nodeRect.originBottom + marginX
          }
          break
        case VERTICAL_TIMELINE:
        case VERTICAL_TIMELINE2:
        case VERTICAL_TIMELINE3:
          if (layerIndex === 0) {
            rotate = true
          }
          x =
            dir === RIGHT
              ? nodeRect.originRight + marginX
              : nodeRect.originLeft - this.placeholderWidth - marginX
          y = nodeRect.originTop + nodeRect.originHeight / 2 - halfPlaceholderHeight
          break
        case FISHBONE:
        case FISHBONE2:
        case RIGHT_FISHBONE:
        case RIGHT_FISHBONE2:
          if (layerIndex <= 1) {
            notRenderPlaceholder = true
            this.mindMap.execCommand('SET_NODE_ACTIVE', this.overlapNode, true)
          } else {
            x = nodeRect.originLeft + nodeRect.originWidth * 0.5
            y =
              dir === BOTTOM
                ? nodeRect.originTop -
                  this.placeholderHeight -
                  this.minOffset +
                  halfPlaceholderHeight
                : nodeRect.originBottom + this.minOffset - halfPlaceholderHeight
          }
          break
        default:
      }
    }
    if (!notRenderPlaceholder) {
      this.setPlaceholderRect({
        x,
        y,
        dir,
        rotate
      })
    }
  }

  // 获取节点的生长方向
  getNewChildNodeDir(node) {
    const {
      LOGICAL_STRUCTURE,
      LOGICAL_STRUCTURE_LEFT,
      MIND_MAP,
      TIMELINE2,
      VERTICAL_TIMELINE,
      VERTICAL_TIMELINE2,
      VERTICAL_TIMELINE3,
      FISHBONE,
      FISHBONE2,
      RIGHT_FISHBONE,
      RIGHT_FISHBONE2
    } = CONSTANTS.LAYOUT
    switch (this.mindMap.opt.layout) {
      case LOGICAL_STRUCTURE:
        return CONSTANTS.LAYOUT_GROW_DIR.RIGHT
      case LOGICAL_STRUCTURE_LEFT:
        return CONSTANTS.LAYOUT_GROW_DIR.LEFT
      case MIND_MAP:
      case TIMELINE2:
      case VERTICAL_TIMELINE:
      case VERTICAL_TIMELINE2:
      case VERTICAL_TIMELINE3:
      case FISHBONE:
      case FISHBONE2:
      case RIGHT_FISHBONE:
      case RIGHT_FISHBONE2:
        return node.dir
      default:
        return ''
    }
  }

  // 垂直方向比较
  // isReverse：是否反向
  handleVerticalCheck(node, checkList, isReverse = false) {
    const { layout } = this.mindMap.opt
    const { LAYOUT, LAYOUT_GROW_DIR } = CONSTANTS
    const {
      VERTICAL_TIMELINE,
      VERTICAL_TIMELINE2,
      VERTICAL_TIMELINE3,
      FISHBONE,
      FISHBONE2,
      RIGHT_FISHBONE,
      RIGHT_FISHBONE2
    } = LAYOUT
    const { LEFT } = LAYOUT_GROW_DIR
    const mouseMoveX = this.mouseMoveX
    const mouseMoveY = this.mouseMoveY
    const nodeRect = this.getNodeRect(node)
    const dir = this.getNewChildNodeDir(node)
    const layerIndex = node.layerIndex
    if (isReverse) {
      checkList = checkList.reverse()
    }
    let halfHeight = nodeRect.originHeight / 2
    let leftExtraArea = 20
    let childZoneWidth = 80
    let { prevBrotherOffset, nextBrotherOffset } = this.getNodeDistanceToSiblingNode(
      checkList,
      node,
      nodeRect,
      'v'
    )
    // 兄弟节点检测范围：节点本体+左侧扩展
    const siblingZone = nodeRect.left - leftExtraArea <= mouseMoveX && nodeRect.right >= mouseMoveX
    // 子节点检测范围：节点右侧区域
    const childZone = mouseMoveX > nodeRect.right && mouseMoveX <= nodeRect.right + childZoneWidth

    if (siblingZone) {
      // 检测兄弟节点位置
      if (!this.overlapNode && !this.prevNode && !this.nextNode && !node.isRoot) {
        // 完整覆盖节点区域的上下半部分插入判断
        const nodeCenter = nodeRect.top + nodeRect.originHeight / 2

        // 下半部分：从节点中心到节点底部及其扩展区域
        let checkIsPrevNode =
          mouseMoveY >= nodeCenter &&
          mouseMoveY <= nodeRect.bottom + (nextBrotherOffset > 0 ? nextBrotherOffset : 0)

        // 上半部分：从节点顶部及其扩展区域到节点中心
        let checkIsNextNode =
          mouseMoveY >= nodeRect.top - (prevBrotherOffset > 0 ? prevBrotherOffset : 0) &&
          mouseMoveY < nodeCenter

        const { scaleY } = this.drawTransform
        let x = dir === LEFT ? nodeRect.originRight - this.placeholderWidth : nodeRect.originLeft
        let notRenderLine = false
        switch (layout) {
          case VERTICAL_TIMELINE:
          case VERTICAL_TIMELINE2:
          case VERTICAL_TIMELINE3:
            if (layerIndex === 1) {
              x = nodeRect.originLeft + nodeRect.originWidth / 2 - this.placeholderWidth / 2
            }
            break
          case RIGHT_FISHBONE:
          case RIGHT_FISHBONE2:
            x = nodeRect.originLeft + nodeRect.originWidth - this.placeholderWidth
            break
          default:
        }
        if (checkIsPrevNode) {
          if (isReverse) {
            this.nextNode = node
          } else {
            this.prevNode = node
          }
          let y =
            nodeRect.originBottom +
            (nextBrotherOffset > 0 ? nextBrotherOffset / scaleY / 2 : this.minOffset) -
            this.placeholderHeight / 2
          switch (layout) {
            case FISHBONE:
            case FISHBONE2:
            case RIGHT_FISHBONE:
            case RIGHT_FISHBONE2:
              if (layerIndex === 2) {
                notRenderLine = true
                y = nodeRect.originBottom + this.minOffset - this.placeholderHeight / 2
              }
              break
            default:
          }
          this.setPlaceholderRect({
            x,
            y,
            dir,
            notRenderLine
          })
        } else if (checkIsNextNode) {
          if (isReverse) {
            this.prevNode = node
          } else {
            this.nextNode = node
          }
          // 插入到该节点之前
          let y =
            nodeRect.originTop -
            (prevBrotherOffset > 0 ? prevBrotherOffset / scaleY / 2 : this.minOffset) -
            this.placeholderHeight / 2
          switch (layout) {
            case FISHBONE:
            case FISHBONE2:
            case RIGHT_FISHBONE:
            case RIGHT_FISHBONE2:
              if (layerIndex === 2) {
                notRenderLine = true
                y =
                  nodeRect.originTop -
                  this.placeholderHeight -
                  this.minOffset +
                  this.placeholderHeight / 2
              }
              break
            default:
          }
          this.setPlaceholderRect({
            x,
            y,
            dir,
            notRenderLine
          })
        }
      }
    } else if (childZone) {
      // 子节点检测：在右侧区域且鼠标在节点Y范围内
      if (mouseMoveY >= nodeRect.top && mouseMoveY <= nodeRect.bottom) {
        this.overlapNode = node
      }
    }
  }

  // 水平方向比较
  handleHorizontalCheck(node, checkList) {
    const { layout } = this.mindMap.opt
    const { LAYOUT } = CONSTANTS
    const { FISHBONE, FISHBONE2, RIGHT_FISHBONE, RIGHT_FISHBONE2, TIMELINE, TIMELINE2 } = LAYOUT
    let mouseMoveX = this.mouseMoveX
    let mouseMoveY = this.mouseMoveY
    let nodeRect = this.getNodeRect(node)
    let halfWidth = nodeRect.originWidth / 2
    let leftExtraArea = 20
    let childZoneWidth = 80
    let { prevBrotherOffset, nextBrotherOffset } = this.getNodeDistanceToSiblingNode(
      checkList,
      node,
      nodeRect,
      'h'
    )

    if (nodeRect.top <= mouseMoveY && nodeRect.bottom >= mouseMoveY) {
      // 检测兄弟节点位置
      if (!this.overlapNode && !this.prevNode && !this.nextNode && !node.isRoot) {
        let checkIsPrevNode =
          nextBrotherOffset > 0 // 距离下一个兄弟节点的距离大于0
            ? mouseMoveX < nodeRect.right + nextBrotherOffset && mouseMoveX >= nodeRect.right // 那么在当前节点外底部判断
            : mouseMoveX <= nodeRect.right && mouseMoveX >= nodeRect.right - halfWidth // 否则在当前节点内右侧1/2区间判断
        let checkIsNextNode =
          prevBrotherOffset > 0 // 距离上一个兄弟节点的距离大于0
            ? mouseMoveX > nodeRect.left - prevBrotherOffset &&
              mouseMoveX <= nodeRect.left + leftExtraArea // 那么在当前节点外左侧判断，包含额外区域
            : mouseMoveX <= nodeRect.left + halfWidth && mouseMoveX >= nodeRect.left - leftExtraArea // 包含节点左侧额外检测区域
        const { scaleX } = this.drawTransform
        const layerIndex = node.layerIndex
        let y = nodeRect.originTop
        let notRenderLine = false
        switch (layout) {
          case TIMELINE:
          case TIMELINE2:
            y = nodeRect.originTop + nodeRect.originHeight / 2 - this.placeholderWidth / 2
            break
          case FISHBONE:
          case FISHBONE2:
          case RIGHT_FISHBONE:
          case RIGHT_FISHBONE2:
            if (layerIndex === 1) {
              notRenderLine = true
              y = nodeRect.originTop + nodeRect.originHeight / 2 - this.placeholderWidth / 2
            }
            break
          default:
        }
        if (checkIsPrevNode) {
          if (([RIGHT_FISHBONE, RIGHT_FISHBONE2] as string[]).includes(layout)) {
            this.nextNode = node
          } else {
            this.prevNode = node
          }
          this.setPlaceholderRect({
            x:
              nodeRect.originRight +
              nextBrotherOffset / scaleX - //nextBrotherOffset已经是实际间距的一半了
              this.placeholderHeight / 2,
            y,
            rotate: true,
            notRenderLine
          })
        } else if (checkIsNextNode) {
          if (([RIGHT_FISHBONE, RIGHT_FISHBONE2] as string[]).includes(layout)) {
            this.prevNode = node
          } else {
            this.nextNode = node
          }
          this.setPlaceholderRect({
            x:
              nodeRect.originLeft -
              this.placeholderHeight -
              prevBrotherOffset / scaleX +
              this.placeholderHeight / 2,
            y,
            rotate: true,
            notRenderLine
          })
        }
      }
      // 检测是否重叠
      this.checkIsOverlap({
        node,
        dir: 'h',
        prevBrotherOffset,
        nextBrotherOffset,
        size: halfWidth,
        pos: mouseMoveX,
        nodeRect
      })
    }
  }

  // 获取节点距前一个和后一个节点的距离
  getNodeDistanceToSiblingNode(checkList, node, nodeRect, dir) {
    const { TOP, LEFT, BOTTOM, RIGHT } = CONSTANTS.LAYOUT_GROW_DIR
    let { scaleX, scaleY } = this.drawTransform
    let dir1 = dir === 'v' ? TOP : LEFT
    let dir2 = dir === 'v' ? BOTTOM : RIGHT
    let scale = dir === 'v' ? scaleY : scaleX
    let minOffset = this.minOffset * scale
    let index = getNodeIndexInNodeList(node, checkList)
    let prevBrother = null
    let nextBrother = null
    if (index !== -1) {
      if (index - 1 >= 0) {
        prevBrother = checkList[index - 1]
      }
      if (index + 1 <= checkList.length - 1) {
        nextBrother = checkList[index + 1]
      }
    }
    // 和前一个兄弟节点的距离
    let prevBrotherOffset = 0
    if (prevBrother) {
      let prevNodeRect = this.getNodeRect(prevBrother)
      prevBrotherOffset = nodeRect[dir1] - prevNodeRect[dir2]
      // 间距小于10就当它不存在
      prevBrotherOffset = prevBrotherOffset >= minOffset ? prevBrotherOffset / 2 : 0
    } else {
      // 没有前一个兄弟节点，那么假设和前一个节点的距离为20
      prevBrotherOffset = minOffset
    }
    // 和后一个兄弟节点的距离
    let nextBrotherOffset = 0
    if (nextBrother) {
      let nextNodeRect = this.getNodeRect(nextBrother)
      nextBrotherOffset = nextNodeRect[dir1] - nodeRect[dir2]
      nextBrotherOffset = nextBrotherOffset >= minOffset ? nextBrotherOffset / 2 : 0
    } else {
      nextBrotherOffset = minOffset
    }
    return {
      prevBrother,
      prevBrotherOffset,
      nextBrother,
      nextBrotherOffset
    }
  }

  // 设置提示元素的大小和位置
  setPlaceholderRect({
    x,
    y,
    dir,
    rotate,
    notRenderLine
  }: {
    x: number
    y: number
    dir?: string
    rotate?: boolean
    notRenderLine?: boolean
  }) {
    let w = this.placeholderWidth
    let h = this.placeholderHeight
    if (rotate) {
      const tmp = w
      w = h
      h = tmp
    }
    this.placeholder.size(w, h).move(x, y)
    if (notRenderLine) {
      return
    }
    const { dragPlaceholderLineConfig } = this.mindMap.opt
    let node = null
    let parent = null
    if (this.overlapNode) {
      node = this.overlapNode
      parent = this.overlapNode
    } else {
      node = this.prevNode || this.nextNode
      parent = node.parent
    }
    parent = parent.fakeClone()
    node = node.fakeClone()
    const tmpNode = (
      this.beingDragNodeList[0] as unknown as { fakeClone(): Record<string, unknown> }
    ).fakeClone()
    ;(tmpNode as unknown as { dir: string }).dir = dir
    tmpNode.left = x
    tmpNode.top = y
    tmpNode.width = w
    tmpNode.height = h
    parent.children = [tmpNode]
    parent._lines = []
    this.placeHolderLine.show()
    this.mindMap.renderer.layout.renderLine(
      parent,
      [this.placeHolderLine],
      (...args) => {
        // node.styleLine(...args)
      },
      node.style.getStyle('lineStyle', true)
    )
    this.placeHolderExtraLines = [...parent._lines]
    this.placeHolderExtraLines.forEach(line => {
      ;(this.mindMap.otherDraw as unknown as { add(el: unknown): void }).add(line)
      line
        .stroke({
          color: (dragPlaceholderLineConfig as { color: string; width: number }).color,
          width: (dragPlaceholderLineConfig as { color: string; width: number }).width
        })
        .fill({ color: 'none' })
    })
  }

  // 检测是否重叠
  checkIsOverlap({ node, dir, prevBrotherOffset, nextBrotherOffset, size, pos, nodeRect }) {
    const { TOP, LEFT, BOTTOM, RIGHT } = CONSTANTS.LAYOUT_GROW_DIR
    let dir1 = dir === 'v' ? TOP : LEFT
    let dir2 = dir === 'v' ? BOTTOM : RIGHT
    if (!this.overlapNode && !this.prevNode && !this.nextNode) {
      if (
        nodeRect[dir1] + (prevBrotherOffset > 0 ? 0 : size) <= pos &&
        nodeRect[dir2] - (nextBrotherOffset > 0 ? 0 : size) >= pos
      ) {
        this.overlapNode = node
      }
    }
  }

  // 处理逻辑结构图
  handleLogicalStructure(node) {
    const checkList = this.commonGetNodeCheckList(node)
    this.handleVerticalCheck(node, checkList)
  }

  // 处理思维导图
  handleMindMap(node) {
    const checkList = node.parent
      ? node.parent.children.filter(item => {
          let sameDir = true
          if (node.layerIndex === 1) {
            sameDir = item.dir === node.dir
          }
          return sameDir && !this.checkIsInBeingDragNodeList(item)
        })
      : []
    this.handleVerticalCheck(node, checkList)
  }

  // 处理组织结构图
  handleOrganizationStructure(node) {
    const checkList = this.commonGetNodeCheckList(node)
    this.handleHorizontalCheck(node, checkList)
  }

  // 处理目录组织图
  handleCatalogOrganization(node) {
    const checkList = this.commonGetNodeCheckList(node)
    if (node.layerIndex === 1) {
      this.handleHorizontalCheck(node, checkList)
    } else {
      this.handleVerticalCheck(node, checkList)
    }
  }

  // 处理时间轴
  handleTimeLine(node) {
    let checkList = this.commonGetNodeCheckList(node)
    if (node.layerIndex === 1) {
      this.handleHorizontalCheck(node, checkList)
    } else {
      this.handleVerticalCheck(node, checkList)
    }
  }

  // 处理时间轴2
  handleTimeLine2(node) {
    let checkList = this.commonGetNodeCheckList(node)
    if (node.layerIndex === 1) {
      this.handleHorizontalCheck(node, checkList)
    } else {
      // 处于上方的三级节点需要特殊处理，因为节点排列方向反向了
      if (node.dir === CONSTANTS.LAYOUT_GROW_DIR.TOP && node.layerIndex === 2) {
        this.handleVerticalCheck(node, checkList, true)
      } else {
        this.handleVerticalCheck(node, checkList)
      }
    }
  }

  // 处理鱼骨图
  handleFishbone(node) {
    let checkList = node.parent
      ? node.parent.children.filter(item => {
          return item.layerIndex > 1 && !this.checkIsInBeingDragNodeList(item)
        })
      : []
    if (node.layerIndex === 1) {
      this.handleHorizontalCheck(node, checkList)
    } else {
      // 处于上方的三级节点需要特殊处理，因为节点排列方向反向了
      const is2LayerTop = node.dir === CONSTANTS.LAYOUT_GROW_DIR.TOP && node.layerIndex === 2
      const is2MoreLayerBottom =
        node.dir === CONSTANTS.LAYOUT_GROW_DIR.BOTTOM && node.layerIndex >= 3
      if (is2LayerTop || is2MoreLayerBottom) {
        this.handleVerticalCheck(node, checkList, true)
      } else {
        this.handleVerticalCheck(node, checkList)
      }
    }
  }

  // 获取节点的兄弟节点列表通用方法
  commonGetNodeCheckList(node) {
    return node.parent
      ? [...node.parent.children].filter(item => {
          return !this.checkIsInBeingDragNodeList(item)
        })
      : []
  }

  // 计算节点的位置尺寸信息
  getNodeRect(node) {
    let { scaleX, scaleY, translateX, translateY } = this.drawTransform
    let { left, top, width, height } = node
    let originWidth = width
    let originHeight = height
    let originLeft = left
    let originTop = top
    let originBottom = top + height
    let originRight = left + width
    let right = (left + width) * scaleX + translateX
    let bottom = (top + height) * scaleY + translateY
    left = left * scaleX + translateX
    top = top * scaleY + translateY
    return {
      left,
      top,
      right,
      bottom,
      originWidth,
      originHeight,
      originLeft,
      originTop,
      originBottom,
      originRight
    }
  }

  // 检查某个节点是否在被拖拽节点内
  checkIsInBeingDragNodeList(node) {
    return !!this.beingDragNodeList.find(item => {
      return item.uid === node.uid || item.isAncestor(node)
    })
  }

  // 插件被移除前做的事情
  beforePluginRemove() {
    this.unBindEvent()
  }

  // 插件被卸载前做的事情
  beforePluginDestroy() {
    this.unBindEvent()
  }
}

Drag.instanceName = 'drag'

export default Drag