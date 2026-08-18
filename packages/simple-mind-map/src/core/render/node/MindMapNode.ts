// @ts-nocheck — vendored engine source
import Style from './Style'
import Shape from './Shape'
import { G, Rect, Text, SVG } from '@svgdotjs/svg.js'
import nodeGeneralizationMethods from './nodeGeneralization'
import nodeExpandBtnMethods from './nodeExpandBtn'
import nodeCommandWrapsMethods from './nodeCommandWraps'
import nodeCreateContentsMethods from './nodeCreateContents'
import nodeExpandBtnPlaceholderRectMethods from './nodeExpandBtnPlaceholderRect'
import nodeModifyWidthMethods from './nodeModifyWidth'
import nodeCooperateMethods from './nodeCooperate'
import quickCreateChildBtnMethods from './quickCreateChildBtn'
import nodeLayoutMethods from './nodeLayout'
import { CONSTANTS } from '../../../constants/constant'
import { copyNodeTree, createUid, addXmlns } from '../../../utils/index'
import type MindMap from '../../../index'
import type { MindMapNodeData, MindMapNode as MindMapNodeInterface } from '../../../types/domain'
//  节点类
class MindMapNode implements MindMapNodeInterface {
  declare opt: Record<string, unknown>
  declare nodeData: {
    data: MindMapNodeData & Record<string, unknown>
    children?: unknown[]
    [key: string]: unknown
  }
  declare nodeDataSnapshot: string
  declare uid: string | undefined
  declare mindMap: MindMap
  declare renderer: {
    activeNodeList: { length: number }
    clearActiveNodeList(): void
    addNodeToActiveList(node: MindMapNode, val: boolean): void
    emitNodeActiveEvent(node?: MindMapNode | null): void
    removeNodeFromActiveList(node: MindMapNode): void
    layout: {
      renderLine(
        node: MindMapNode,
        lines: unknown[],
        styleCallback: (...args: unknown[]) => void,
        style: unknown
      ): void
      nodeIsRemoveAllLines?(node: MindMapNode): boolean
    }
    [key: string]: unknown
  }
  declare draw: G
  declare nodeDraw: G
  declare lineDraw: G
  declare style: Style
  declare effectiveStyles: Record<string, unknown>
  declare shapeInstance: Shape
  declare shapePadding: { paddingX: number; paddingY: number }
  declare data: MindMapNodeData
  declare setIcon: (icons: string[]) => void
  declare isRoot: boolean
  declare isGeneralization: boolean
  declare generalizationBelongNode: MindMapNode | null
  declare layerIndex: number
  declare width: number
  declare height: number
  declare customTextWidth: number | undefined
  declare _left: number
  declare _top: number
  declare customLeft: number | undefined
  declare customTop: number | undefined
  declare isDrag: boolean
  declare parent: MindMapNode | null
  declare children: MindMapNode[]
  declare userList: unknown[]
  declare group: G | null
  declare shapeNode: G | null
  declare hoverNode: G | null
  declare _customNodeContent: unknown
  declare _imgData: unknown
  declare _iconData: unknown
  declare _textData: unknown
  declare _hyperlinkData: unknown
  declare _tagData: unknown
  declare _noteData: unknown
  declare noteEl: unknown
  declare noteContentIsShow: boolean
  declare _attachmentData: unknown
  declare _prefixData: unknown
  declare _postfixData: unknown
  declare _expandBtn: unknown
  declare _lastExpandBtnType: string | null
  declare _showExpandBtn: boolean
  declare _openExpandNode: unknown
  declare _closeExpandNode: unknown
  declare _fillExpandNode: unknown
  declare _userListGroup: unknown
  declare _lines: { hide(): void; show(): void; opacity(val: number): void; remove(): void }[]
  declare _generalizationList: unknown[]
  declare _unVisibleRectRegionNode: unknown
  declare _isMouseenter: boolean
  declare _customContentAddToNodeAdd: unknown
  declare _rectInfo: {
    textContentWidth: number
    textContentHeight: number
    textContentWidthWithoutTag: number
  }
  declare _generalizationNodeWidth: number
  declare _generalizationNodeHeight: number
  declare expandBtnSize: number
  declare isMultipleChoice: boolean
  declare needLayout: boolean
  declare isHide: boolean
  declare _contentWidth: number
  declare _alignedWidth: number | undefined
  declare _commentLabelData: unknown
  // Methods mixed-in via prototype (placeholders overridden at runtime)
  layout(): void {}
  getNodeRect(): { width: number; height: number } {
    return { width: 0, height: 0 }
  }
  initQuickCreateChildBtn(): void {}
  initDragHandle(): void {}
  updateDragHandle(): void {}
  updateGeneralization(): void {}
  showExpandBtn(): void {}
  hideExpandBtn(): void {}
  removeExpandBtn(): void {}
  renderExpandBtn(): void {}
  showQuickCreateChildBtn(): void {}
  hideQuickCreateChildBtn(): void {}
  removeQuickCreateChildBtn(): void {}
  renderGeneralization(forceRender?: boolean): void {}
  removeGeneralization(): void {}
  hideGeneralization(): void {}
  showGeneralization(): void {}
  setGeneralizationOpacity(val: number): void {}
  handleGeneralizationMouseenter(): void {}
  handleGeneralizationMouseleave(): void {}
  checkHasGeneralization(): boolean {
    return false
  }
  updateUserListNode(): void {}
  emptyUser(): void {}
  updateExpandBtnPlaceholderRect(): void {}
  createImgNode(): unknown {
    return null
  }
  createIconNode(): unknown {
    return null
  }
  createTextNode(): unknown {
    return null
  }
  createHyperlinkNode(): unknown {
    return null
  }
  createTagNode(): unknown {
    return null
  }
  createNoteNode(): unknown {
    return null
  }
  createAttachmentNode(): unknown {
    return null
  }
  createCommentLabelNode(): unknown {
    return null
  }
  //  构造函数
  constructor(
    opt: {
      mindMap?: MindMap
      renderer?: Record<string, unknown>
      data?: {
        data?: {
          customTextWidth?: number
          customLeft?: number
          customTop?: number
          [key: string]: unknown
        }
        children?: unknown[]
        [key: string]: unknown
      }
      uid?: string
      isRoot?: boolean
      isGeneralization?: boolean
      layerIndex?: number
      width?: number
      height?: number
      left?: number
      top?: number
      parent?: MindMapNode
      children?: MindMapNode[]
      [key: string]: unknown
    } = {}
  ) {
    this.opt = opt
    // 节点数据
    this.nodeData = this.handleData(opt.data || {})
    // 保存本次更新时的节点数据快照
    this.nodeDataSnapshot = ''
    // uid
    this.uid = opt.uid
    // 控制实例
    this.mindMap = opt.mindMap
    // 渲染实例
    this.renderer = opt.renderer as typeof this.renderer
    // 渲染器
    this.draw = this.mindMap.draw
    this.nodeDraw = this.mindMap.nodeDraw
    this.lineDraw = this.mindMap.lineDraw
    // 样式实例
    this.style = new Style(this)
    // 节点当前生效的全部样式
    this.effectiveStyles = {}
    // 形状实例
    this.shapeInstance = new Shape(this)
    this.shapePadding = {
      paddingX: 0,
      paddingY: 0
    }
    // 是否是根节点
    this.isRoot = opt.isRoot === undefined ? false : opt.isRoot
    // 是否是概要节点
    this.isGeneralization = opt.isGeneralization === undefined ? false : opt.isGeneralization
    this.generalizationBelongNode = null
    // 节点层级
    this.layerIndex = opt.layerIndex === undefined ? 0 : opt.layerIndex
    // 节点宽
    this.width = opt.width || 0
    // 节点高
    this.height = opt.height || 0
    // 自定义文本的宽度
    this.customTextWidth = opt.data.data.customTextWidth || undefined
    // left
    this._left = opt.left || 0
    // top
    this._top = opt.top || 0
    // 自定义位置
    this.customLeft = opt.data.data.customLeft || undefined
    this.customTop = opt.data.data.customTop || undefined
    // 是否正在拖拽中
    this.isDrag = false
    // 父节点
    this.parent = opt.parent || null
    // 子节点
    this.children = opt.children || []
    // 当前同时操作该节点的用户列表
    this.userList = []
    // 节点内容的容器
    this.group = null
    this.shapeNode = null // 节点形状节点
    this.hoverNode = null // 节点hover和激活的节点
    // 节点内容对象
    this._customNodeContent = null
    this._imgData = null
    this._iconData = null
    this._textData = null
    this._hyperlinkData = null
    this._tagData = null
    this._noteData = null
    this.noteEl = null
    this.noteContentIsShow = false
    this._attachmentData = null
    this._prefixData = null
    this._postfixData = null
    this._expandBtn = null
    this._lastExpandBtnType = null
    this._showExpandBtn = false
    this._openExpandNode = null
    this._closeExpandNode = null
    this._fillExpandNode = null
    this._userListGroup = null
    this._lines = []
    this._generalizationList = []
    this._unVisibleRectRegionNode = null
    this._isMouseenter = false
    this._customContentAddToNodeAdd = null
    // 尺寸信息
    this._rectInfo = {
      textContentWidth: 0,
      textContentHeight: 0,
      textContentWidthWithoutTag: 0
    }
    // 概要节点的宽高
    this._generalizationNodeWidth = 0
    this._generalizationNodeHeight = 0
    // 展开收缩按钮尺寸
    this.expandBtnSize = this.mindMap.opt.expandBtnSize as number
    // 是否是多选节点
    this.isMultipleChoice = false
    // 是否需要重新layout
    this.needLayout = false
    // 当前是否是隐藏状态
    this.isHide = false
    const proto = Object.getPrototypeOf(this)
    if (!proto.bindEvent) {
      // 节点尺寸计算和布局相关方法
      Object.keys(nodeLayoutMethods).forEach(item => {
        proto[item] = nodeLayoutMethods[item]
      })
      // 概要相关方法
      Object.keys(nodeGeneralizationMethods).forEach(item => {
        proto[item] = nodeGeneralizationMethods[item]
      })
      // 展开收起按钮相关方法
      Object.keys(nodeExpandBtnMethods).forEach(item => {
        proto[item] = nodeExpandBtnMethods[item]
      })
      // 展开收起按钮占位元素相关方法
      Object.keys(nodeExpandBtnPlaceholderRectMethods).forEach(item => {
        proto[item] = nodeExpandBtnPlaceholderRectMethods[item]
      })
      // 命令的相关方法
      Object.keys(nodeCommandWrapsMethods).forEach(item => {
        proto[item] = nodeCommandWrapsMethods[item]
      })
      // 创建节点内容的相关方法
      Object.keys(nodeCreateContentsMethods).forEach(item => {
        proto[item] = nodeCreateContentsMethods[item]
      })
      // 协同相关
      if (this.mindMap.cooperate) {
        Object.keys(nodeCooperateMethods).forEach(item => {
          proto[item] = nodeCooperateMethods[item]
        })
      }
      // 拖拽调整节点宽度
      Object.keys(nodeModifyWidthMethods).forEach(item => {
        proto[item] = nodeModifyWidthMethods[item]
      })
      // 快捷创建子节点按钮
      if (this.mindMap.opt.isShowCreateChildBtnIcon) {
        Object.keys(quickCreateChildBtnMethods).forEach(item => {
          proto[item] = quickCreateChildBtnMethods[item]
        })
        this.initQuickCreateChildBtn()
      }
      proto.bindEvent = true
    }
    // 初始化
    this.getSize()
    // 初始需要计算一下概要节点的大小，否则计算布局时获取不到概要的大小
    this.updateGeneralization()
    this.initDragHandle()
  }

  // 支持自定义位置
  get left() {
    return this.customLeft || this._left
  }

  set left(val) {
    this._left = val
  }

  get top() {
    return this.customTop || this._top
  }

  set top(val) {
    this._top = val
  }

  //  复位部分布局时会重新设置的数据
  reset() {
    this.children = []
    this.parent = null
    this.isRoot = false
    this.layerIndex = 0
    this.left = 0
    this.top = 0
  }

  // 节点被删除时需要复位的数据
  resetWhenDelete() {
    this._isMouseenter = false
  }

  //  处理数据
  handleData(data) {
    data.data.expand = data.data.expand === false ? false : true
    data.data.isActive = data.data.isActive === true ? true : false
    data.children = data.children || []
    return data
  }

  //  创建节点的各个内容对象数据
  // recreateTypes：[] custom、image、icon、text、hyperlink、tag、note、attachment、numbers、prefix、postfix、checkbox
  createNodeData(recreateTypes: string[] | undefined) {
    const {
      isUseCustomNodeContent,
      customCreateNodeContent,
      createNodePrefixContent,
      createNodePostfixContent,
      addCustomContentToNode
    } = this.mindMap.opt
    const typeList: string[] = [
      'custom',
      'image',
      'icon',
      'text',
      'hyperlink',
      'tag',
      'note',
      'attachment',
      'commentLabel',
      'prefix',
      'postfix',
      ...this.mindMap.nodeInnerPrefixList.map((item: Record<string, unknown>) => {
        return item.name as string
      }),
      ...this.mindMap.nodeInnerPostfixList.map((item: Record<string, unknown>) => {
        return item.name as string
      })
    ]
    const createTypes: Record<string, boolean> = {}
    if (Array.isArray(recreateTypes)) {
      typeList.forEach((item: string) => {
        if ((recreateTypes as string[]).includes(item)) {
          createTypes[item] = true
        }
      })
    } else {
      typeList.forEach((item: string) => {
        createTypes[item] = true
      })
    }
    if (isUseCustomNodeContent && customCreateNodeContent && createTypes.custom) {
      this._customNodeContent = (customCreateNodeContent as (node: MindMapNode) => unknown)(this)
    }
    if (this._customNodeContent) {
      addXmlns(this._customNodeContent)
      return
    }
    if (createTypes.image) this._imgData = this.createImgNode()
    if (createTypes.icon) this._iconData = this.createIconNode()
    if (createTypes.text) this._textData = this.createTextNode()
    if (createTypes.hyperlink) this._hyperlinkData = this.createHyperlinkNode()
    if (createTypes.tag) this._tagData = this.createTagNode()
    if (createTypes.note) this._noteData = this.createNoteNode()
    if (createTypes.attachment) this._attachmentData = this.createAttachmentNode()
    if (createTypes.commentLabel) this._commentLabelData = this.createCommentLabelNode()
    this.mindMap.nodeInnerPrefixList.forEach((item: Record<string, unknown>) => {
      const typedItem = item as { name: string; createContent: (node: MindMapNode) => unknown }
      if (createTypes[typedItem.name]) {
        this[`_${typedItem.name}Data`] = typedItem.createContent(this)
      }
    })
    if (createTypes.prefix) {
      this._prefixData = createNodePrefixContent
        ? (createNodePrefixContent as (node: MindMapNode) => unknown)(this)
        : null
      if (this._prefixData && (this._prefixData as { el: unknown }).el) {
        addXmlns((this._prefixData as { el: unknown }).el)
      }
    }
    if (createTypes.postfix) {
      this._postfixData = createNodePostfixContent
        ? (createNodePostfixContent as (node: MindMapNode) => unknown)(this)
        : null
      if (this._postfixData && (this._postfixData as { el: unknown }).el) {
        addXmlns((this._postfixData as { el: unknown }).el)
      }
    }
    this.mindMap.nodeInnerPostfixList.forEach((item: Record<string, unknown>) => {
      const typedItem = item as { name: string; createContent: (node: MindMapNode) => unknown }
      if (createTypes[typedItem.name]) {
        this[`_${typedItem.name}Data`] = typedItem.createContent(this)
      }
    })
    if (
      addCustomContentToNode &&
      typeof (addCustomContentToNode as { create?: unknown }).create === 'function'
    ) {
      this._customContentAddToNodeAdd = (
        addCustomContentToNode as { create: (node: MindMapNode) => unknown }
      ).create(this)
      if (
        this._customContentAddToNodeAdd &&
        (this._customContentAddToNodeAdd as { el: unknown }).el
      ) {
        addXmlns((this._customContentAddToNodeAdd as { el: unknown }).el)
      }
    }
  }

  //  计算节点的宽高
  getSize(
    recreateTypes?: string[],
    opt: { ignoreUpdateCustomTextWidth?: boolean; [key: string]: unknown } = {}
  ) {
    const ignoreUpdateCustomTextWidth = opt.ignoreUpdateCustomTextWidth || false
    if (!ignoreUpdateCustomTextWidth) {
      this.customTextWidth = (this.getData('customTextWidth') as number) || undefined
    }
    this.customLeft = (this.getData('customLeft') as number) || undefined
    this.customTop = (this.getData('customTop') as number) || undefined
    // 这里不要更新概要，不然即使概要没修改，每次也会重新渲染
    // this.updateGeneralization()
    this.createNodeData(recreateTypes)
    let { width, height } = this.getNodeRect()
    // 保存内容的自然宽度，供 alignSameLevelNodeWidth 使用
    this._contentWidth = width
    // 如果开启了同层级节点等宽对齐，且之前已经有对齐宽度缓存
    // 则确保宽度不小于对齐宽度，避免单节点 reRender 时宽度收缩导致闪烁
    if (
      this.mindMap.opt.alignSameLevelNodeWidth &&
      !this.isRoot &&
      this._alignedWidth &&
      width < this._alignedWidth
    ) {
      width = this._alignedWidth
    }
    // 判断节点尺寸是否有变化
    const changed = this.width !== width || this.height !== height
    this.width = width
    this.height = height
    return changed
  }

  // 给节点绑定事件
  bindGroupEvent() {
    // 单击事件，选中节点
    this.group.on('click', e => {
      this.mindMap.emit('node_click', this, e)
      if (this.isMultipleChoice) {
        e.stopPropagation()
        this.isMultipleChoice = false
        return
      }
      if (this.mindMap.opt.onlyOneEnableActiveNodeOnCooperate && this.userList.length > 0) {
        return
      }
      this.active(e)
    })
    this.group.on('mousedown', e => {
      const me = e as MouseEvent
      const {
        readonly,
        enableCtrlKeyNodeSelection,
        useLeftKeySelectionRightKeyDrag,
        mousedownEventPreventDefault
      } = this.mindMap.opt
      if (mousedownEventPreventDefault) {
        me.preventDefault()
      }
      // 只读模式不需要阻止冒泡
      if (!readonly) {
        if (this.isRoot) {
          // 根节点，右键拖拽画布模式下不需要阻止冒泡
          if (me.which === 3 && !useLeftKeySelectionRightKeyDrag) {
            me.stopPropagation()
          }
        } else {
          // 非根节点，且按下的是非鼠标中键，需要阻止事件冒泡
          if (me.which !== 2) {
            me.stopPropagation()
          }
        }
      }
      // 多选和取消多选
      if (!readonly && (me.ctrlKey || me.metaKey) && enableCtrlKeyNodeSelection) {
        this.isMultipleChoice = true
        const isActive = this.getData('isActive')
        if (!isActive) this.mindMap.emit('before_node_active', this, this.renderer.activeNodeList)
        this.mindMap.renderer[isActive ? 'removeNodeFromActiveList' : 'addNodeToActiveList'](
          this,
          true
        )
        this.renderer.emitNodeActiveEvent(isActive ? null : this)
      }
      this.mindMap.emit('node_mousedown', this, me)
    })
    this.group.on('mouseup', e => {
      const me = e as MouseEvent
      if (!this.isRoot && me.which !== 2 && !this.mindMap.opt.readonly) {
        me.stopPropagation()
      }
      this.mindMap.emit('node_mouseup', this, me)
    })
    this.group.on('mouseenter', e => {
      if (this.isDrag) return
      this._isMouseenter = true
      // 显示展开收起按钮
      this.showExpandBtn()
      if (this.isGeneralization) {
        this.handleGeneralizationMouseenter()
      }
      this.mindMap.emit('node_mouseenter', this, e)
    })
    this.group.on('mouseleave', e => {
      if (!this._isMouseenter) return
      this._isMouseenter = false
      this.hideExpandBtn()
      if (this.isGeneralization) {
        this.handleGeneralizationMouseleave()
      }
      this.mindMap.emit('node_mouseleave', this, e)
    })
    // 双击事件
    this.group.on('dblclick', e => {
      const me = e as MouseEvent
      const { readonly, onlyOneEnableActiveNodeOnCooperate } = this.mindMap.opt
      if (readonly || me.ctrlKey || me.metaKey) {
        return
      }
      me.stopPropagation()
      if (onlyOneEnableActiveNodeOnCooperate && this.userList.length > 0) {
        return
      }
      this.mindMap.emit('node_dblclick', this, me)
    })
    // 右键菜单事件
    this.group.on('contextmenu', e => {
      const me = e as MouseEvent
      const { readonly, useLeftKeySelectionRightKeyDrag, allowReadonlyContextMenu } =
        this.mindMap.opt
      // Mac上按住ctrl键点击鼠标左键不知为何触发的是contextmenu事件
      if ((readonly && !allowReadonlyContextMenu) || me.ctrlKey) {
        return
      }
      me.stopPropagation()
      me.preventDefault()
      // 如果是多选节点结束，那么不要触发右键菜单事件
      if (
        (this.mindMap as { select?: { hasSelectRange(): boolean } }).select &&
        !useLeftKeySelectionRightKeyDrag &&
        (this.mindMap as { select?: { hasSelectRange(): boolean } }).select!.hasSelectRange()
      ) {
        return
      }
      // 如果有且只有当前节点激活了，那么不需要重新激活
      if (!(this.getData('isActive') && this.renderer.activeNodeList.length === 1)) {
        this.renderer.clearActiveNodeList()
        this.active(me)
      }
      this.mindMap.emit('node_contextmenu', me, this)
    })
  }

  //  激活节点
  active(e?) {
    if (this.mindMap.opt.readonly && !this.mindMap.opt.allowReadonlyContextMenu) {
      return
    }
    e && e.stopPropagation()
    if (this.getData('isActive')) {
      return
    }
    this.mindMap.emit('before_node_active', this, this.renderer.activeNodeList)
    this.renderer.clearActiveNodeList()
    this.renderer.addNodeToActiveList(this, true)
    this.renderer.emitNodeActiveEvent(this)
  }

  // 取消激活该节点
  deactivate() {
    this.mindMap.renderer.removeNodeFromActiveList(this)
    this.mindMap.renderer.emitNodeActiveEvent()
  }

  //  更新节点
  update(forceRender?) {
    if (!this.group) {
      return
    }
    this.updateNodeActiveClass()
    const { alwaysShowExpandBtn, notShowExpandBtn, isShowCreateChildBtnIcon, readonly } =
      this.mindMap.opt
    const childrenLength = this.getChildrenLength()
    // 不显示展开收起按钮则不需要处理
    if (!notShowExpandBtn) {
      if (alwaysShowExpandBtn) {
        // 需要移除展开收缩按钮
        if (this._expandBtn && childrenLength <= 0) {
          this.removeExpandBtn()
        } else {
          // 更新展开收起按钮
          this.renderExpandBtn()
        }
      } else {
        const { isActive, expand } = this.getData()
        // 展开状态且非激活状态，且当前鼠标不在它上面，才隐藏
        if (childrenLength <= 0) {
          this.removeExpandBtn()
        } else if (expand && !isActive && !this._isMouseenter) {
          this.hideExpandBtn()
        } else {
          this.showExpandBtn()
        }
      }
    }
    // 更新快速创建子节点按钮
    if (isShowCreateChildBtnIcon) {
      if (childrenLength > 0) {
        this.removeQuickCreateChildBtn()
      } else {
        const { isActive } = this.getData()
        if (isActive) {
          this.showQuickCreateChildBtn()
        } else {
          this.hideQuickCreateChildBtn()
        }
      }
    }
    // 更新拖拽手柄的显示与否
    this.updateDragHandle()
    // 更新概要
    this.renderGeneralization(forceRender)
    // 更新协同头像
    if (this.updateUserListNode) this.updateUserListNode()
    // 更新节点位置
    const t = this.group.transform()
    // 保存一份当前节点数据快照
    this.nodeDataSnapshot = readonly ? '' : JSON.stringify(this.getData())
    // 节点位置变化才更新，因为即使值没有变化属性设置操作也是耗时的
    if (this.left !== t.translateX || this.top !== t.translateY) {
      this.group.translate(this.left - t.translateX, this.top - t.translateY)
    }
  }

  // 获取节点相当于画布的位置
  getNodePosInClient(_left, _top) {
    const drawTransform = this.mindMap.draw.transform()
    const { scaleX, scaleY, translateX, translateY } = drawTransform
    const left = _left * scaleX + translateX
    const top = _top * scaleY + translateY
    return {
      left,
      top
    }
  }

  // 判断节点是否可见
  checkIsInClient(padding = 0) {
    const { left: nx, top: ny } = this.getNodePosInClient(this.left, this.top)
    return (
      nx + this.width > 0 - padding &&
      ny + this.height > 0 - padding &&
      nx < this.mindMap.width + padding &&
      ny < this.mindMap.height + padding
    )
  }
  // 重新渲染节点，即重新创建节点内容、计算节点大小、计算节点内容布局、更新展开收起按钮，概要及位置
  reRender(recreateTypes, opt) {
    const sizeChange = this.getSize(recreateTypes, opt)
    this.layout()
    this.update()
    return sizeChange
  }

  // 更新节点激活状态
  updateNodeActiveClass() {
    if (!this.group) return
    const isActive = this.getData('isActive')
    this.group[isActive ? 'addClass' : 'removeClass']('active')
  }

  // 根据是否激活更新节点
  updateNodeByActive(active) {
    if (this.group) {
      const { isShowCreateChildBtnIcon } = this.mindMap.opt
      // 切换激活状态，需要切换展开收起按钮的显隐
      if (active) {
        this.showExpandBtn()
        if (isShowCreateChildBtnIcon) {
          this.showQuickCreateChildBtn()
        }
      } else {
        this.hideExpandBtn()
        if (isShowCreateChildBtnIcon) {
          this.hideQuickCreateChildBtn()
        }
      }
      this.updateNodeActiveClass()
      this.updateDragHandle()
    }
  }

  // 递归渲染
  // forceRender：强制渲染，无论是否处于画布可视区域
  // async：异步渲染
  render(callback = () => {}, forceRender = false, async = false) {
    // 节点
    // 重新渲染连线
    this.renderLine()
    const { openPerformance, performanceConfig } = this.mindMap.opt
    // 强制渲染、或没有开启性能模式、或不在画布可视区域内不渲染节点内容
    // 根节点不进行懒加载，始终渲染，因为滚动条插件依赖根节点进行计算
    if (
      forceRender ||
      !openPerformance ||
      this.checkIsInClient((performanceConfig as { padding?: number }).padding || 0) ||
      this.isRoot
    ) {
      if (!this.group) {
        // 创建组
        this.group = new G()
        this.group.addClass('smm-node')
        this.group.css({
          cursor: 'default'
        })
        this.bindGroupEvent()
        this.nodeDraw.add(this.group)
        this.layout()
        this.update(forceRender)
      } else {
        if (!this.nodeDraw.has(this.group)) {
          this.nodeDraw.add(this.group)
        }
        if (this.needLayout) {
          this.needLayout = false
          this.layout()
        }
        this.updateExpandBtnPlaceholderRect()
        this.update(forceRender)
      }
    } else if (
      openPerformance &&
      (performanceConfig as { removeNodeWhenOutCanvas?: boolean }).removeNodeWhenOutCanvas
    ) {
      this.removeSelf()
    }
    // 子节点
    if (this.children && this.children.length && this.getData('expand') !== false) {
      let index = 0
      this.children.forEach(item => {
        const renderChild = () => {
          item.render(
            () => {
              index++
              if (index >= this.children.length) {
                callback()
              }
            },
            forceRender,
            async
          )
        }
        if (async) {
          setTimeout(renderChild, 0)
        } else {
          renderChild()
        }
      })
    } else {
      callback()
    }
    // 手动插入的节点立即获得焦点并且开启编辑模式
    if (this.nodeData.inserting) {
      delete this.nodeData.inserting
      this.active()
      // setTimeout(() => {
      this.mindMap.emit('node_dblclick', this, null, true)
      // }, 0)
    }
  }

  // 删除自身，只是从画布删除，节点容器还在，后续还可以重新插回画布
  removeSelf() {
    if (!this.group) return
    this.group.remove()
    this.removeGeneralization()
  }

  //  递归删除，只是从画布删除，节点容器还在，后续还可以重新插回画布
  remove() {
    if (!this.group) return
    this.group.remove()
    this.removeGeneralization()
    this.removeLine()
    // 子节点
    if (this.children && this.children.length) {
      this.children.forEach(item => {
        item.remove()
      })
    }
  }

  // 销毁节点，不但会从画布删除，而且原节点直接置空，后续无法再插回画布
  destroy() {
    this.removeLine()
    if (this.parent) {
      this.parent.removeLine()
    }
    if (!this.group) return
    if (this.emptyUser) {
      this.emptyUser()
    }
    this.resetWhenDelete()
    this.group.remove()
    this.removeGeneralization()
    this.group = null
    this.style.onRemove()
  }

  //  隐藏节点
  hide() {
    if (this.group) this.group.hide()
    this.hideGeneralization()
    if (this.parent) {
      const index = this.parent.children.indexOf(this)
      this.parent._lines[index] && this.parent._lines[index].hide()
      this._lines.forEach(item => {
        item.hide()
      })
    }
    // 子节点
    if (this.children && this.children.length) {
      this.children.forEach(item => {
        item.hide()
      })
    }
  }

  //  显示节点
  show() {
    if (!this.group) {
      return
    }
    this.group.show()
    this.showGeneralization()
    if (this.parent) {
      const index = this.parent.children.indexOf(this)
      this.parent._lines[index] && this.parent._lines[index].show()
      this._lines.forEach(item => {
        item.show()
      })
    }
    // 子节点
    if (this.children && this.children.length) {
      this.children.forEach(item => {
        item.show()
      })
    }
  }

  // 设置节点透明度
  // 包括连接线和下级节点
  setOpacity(val) {
    // 自身及连线
    if (this.group) this.group.opacity(val)
    this._lines.forEach(line => {
      line.opacity(val)
    })
    // 子节点
    this.children.forEach(item => {
      item.setOpacity(val)
    })
    // 概要节点
    this.setGeneralizationOpacity(val)
  }

  // 隐藏子节点
  hideChildren() {
    this._lines.forEach(item => {
      item.hide()
    })
    if (this.children && this.children.length) {
      this.children.forEach(item => {
        item.hide()
      })
    }
  }

  // 显示子节点
  showChildren() {
    this._lines.forEach(item => {
      item.show()
    })
    if (this.children && this.children.length) {
      this.children.forEach(item => {
        item.show()
      })
    }
  }

  // 被拖拽中
  startDrag() {
    this.isDrag = true
    if (this.group) this.group.addClass('smm-node-dragging')
  }

  // 拖拽结束
  endDrag() {
    this.isDrag = false
    if (this.group) this.group.removeClass('smm-node-dragging')
  }

  //  连线
  renderLine(deep = false) {
    if (this.getData('expand') === false) {
      return
    }
    let childrenLen = this.getChildrenLength()
    // 切换为鱼骨结构时，清空根节点和二级节点的连线
    if (this.mindMap.renderer.layout.nodeIsRemoveAllLines) {
      if (this.mindMap.renderer.layout.nodeIsRemoveAllLines(this)) {
        childrenLen = 0
      }
    }
    if (childrenLen > this._lines.length) {
      // 创建缺少的线
      new Array(childrenLen - this._lines.length).fill(0).forEach(() => {
        this._lines.push(this.lineDraw.path())
      })
    } else if (childrenLen < this._lines.length) {
      // 删除多余的线
      this._lines.slice(childrenLen).forEach(line => {
        line.remove()
      })
      this._lines = this._lines.slice(0, childrenLen)
    }
    // 画线
    this.renderer.layout.renderLine(
      this,
      this._lines,
      (...args) => {
        // 添加样式
        this.styleLine(...(args as [unknown, MindMapNode, boolean]))
      },
      this.style.getStyle('lineStyle', true)
    )
    // 子级的连线也需要更新
    if (deep && this.children && this.children.length > 0) {
      this.children.forEach(item => {
        item.renderLine(deep)
      })
    }
  }

  //  获取节点形状
  getShape() {
    // 节点使用功能横线风格的话不支持设置形状，直接使用默认的矩形
    return this.mindMap.themeConfig.nodeUseLineStyle
      ? CONSTANTS.SHAPE.RECTANGLE
      : this.style.getStyle('shape', false)
  }

  //  检查节点是否存在自定义数据
  hasCustomPosition() {
    return this.customLeft !== undefined && this.customTop !== undefined
  }

  ancestorHasCustomPosition() {
    let node: MindMapNode | null = this
    while (node) {
      if (node.hasCustomPosition()) {
        return true
      }
      node = node.parent
    }
    return false
  }

  //  检查是否存在有概要的祖先节点
  ancestorHasGeneralization() {
    let node = this.parent
    while (node) {
      if (node.checkHasGeneralization()) {
        return true
      }
      node = node.parent
    }
    return false
  }

  //  添加子节点
  addChildren(node) {
    this.children.push(node)
  }

  //  设置连线样式
  styleLine(line, childNode, enableMarker) {
    const { enableInheritAncestorLineStyle } = this.mindMap.opt
    const getName = enableInheritAncestorLineStyle ? 'getSelfInhertStyle' : 'getSelfStyle'
    const width = childNode[getName]('lineWidth') || childNode.getStyle('lineWidth', true)
    const color =
      childNode[getName]('lineColor') ||
      this.getRainbowLineColor(childNode) ||
      childNode.getStyle('lineColor', true)
    const dasharray =
      childNode[getName]('lineDasharray') || childNode.getStyle('lineDasharray', true)
    this.style.line(
      line,
      {
        width,
        color,
        dasharray
      },
      enableMarker,
      childNode
    )
  }

  // 获取彩虹线条颜色
  getRainbowLineColor(node) {
    const rainbowLines = (this.mindMap as unknown as Record<string, unknown>)['rainbowLines'] as
      | { getNodeColor(node: MindMapNode): string }
      | undefined
    return rainbowLines ? rainbowLines.getNodeColor(node) : ''
  }

  //  移除连线
  removeLine() {
    this._lines.forEach(line => {
      line.remove()
    })
    this._lines = []
  }

  //  检测当前节点是否是某个节点的祖先节点
  isAncestor(node) {
    if (this.uid === node.uid) {
      return false
    }
    let parent = node.parent
    while (parent) {
      if (this.uid === parent.uid) {
        return true
      }
      parent = parent.parent
    }
    return false
  }

  // 检查当前节点是否是某个节点的父节点
  isParent(node) {
    if (this.uid === node.uid) {
      return false
    }
    const parent = node.parent
    if (parent && this.uid === parent.uid) {
      return true
    }
    return false
  }

  //  检测当前节点是否是某个节点的兄弟节点
  isBrother(node) {
    if (!this.parent || this.uid === node.uid) {
      return false
    }
    return this.parent.children.find(item => {
      return item.uid === node.uid
    })
  }

  // 获取该节点在兄弟节点列表中的索引
  getIndexInBrothers() {
    return this.parent && this.parent.children
      ? this.parent.children.findIndex(item => {
          return item.uid === this.uid
        })
      : -1
  }

  //  获取padding值
  getPaddingVale() {
    return {
      paddingX: this.getStyle('paddingX'),
      paddingY: this.getStyle('paddingY')
    }
  }

  //  获取某个样式
  getStyle(prop, root?) {
    const v = this.style.merge(prop, root)
    return v === undefined ? '' : v
  }

  //  获取自定义样式
  getSelfStyle(prop) {
    return this.style.getSelfStyle(prop)
  }

  //   获取最近一个存在自身自定义样式的祖先节点的自定义样式
  getParentSelfStyle(prop) {
    if (this.parent) {
      return this.parent.getSelfStyle(prop) || this.parent.getParentSelfStyle(prop)
    }
    return null
  }

  //  获取自身可继承的自定义样式
  getSelfInhertStyle(prop) {
    return (
      this.getSelfStyle(prop) || // 自身
      this.getParentSelfStyle(prop)
    ) // 父级
  }

  // 获取节点非节点状态的边框大小
  getBorderWidth() {
    return this.style.merge('borderWidth', false) || 0
  }

  //  获取数据
  getData(): MindMapNodeData
  getData<K extends keyof MindMapNodeData>(key: K): MindMapNodeData[K]
  getData(key?: string): MindMapNodeData | MindMapNodeData[keyof MindMapNodeData] {
    return (key ? this.nodeData.data[key] : this.nodeData.data) as
      | MindMapNodeData
      | MindMapNodeData[keyof MindMapNodeData]
  }

  // 获取该节点的纯数据，即不包含对节点实例的引用
  getPureData(removeActiveState = true, removeId = false) {
    return copyNodeTree({}, this, removeActiveState, removeId)
  }

  // 获取祖先节点列表
  getAncestorNodes() {
    const list = []
    let parent = this.parent
    while (parent) {
      list.unshift(parent)
      parent = parent.parent
    }
    return list
  }

  // 是否存在自定义样式
  hasCustomStyle() {
    return this.style.hasCustomStyle()
  }

  // 获取节点的尺寸和位置信息，宽高是应用了缩放效果后的实际宽高，位置是相对于浏览器窗口左上角的位置
  getRect() {
    return this.group ? this.group.rbox() : null
  }

  // 获取节点的尺寸和位置信息，宽高是应用了缩放效果后的实际宽高，位置信息相对于画布
  getRectInSvg() {
    const { scaleX, scaleY, translateX, translateY } = this.mindMap.draw.transform()
    let { left, top, width, height } = this
    const right = (left + width) * scaleX + translateX
    const bottom = (top + height) * scaleY + translateY
    left = left * scaleX + translateX
    top = top * scaleY + translateY
    return {
      left,
      right,
      top,
      bottom,
      width: width * scaleX,
      height: height * scaleY
    }
  }

  // 高亮节点
  highlight() {
    if (this.group) this.group.addClass('smm-node-highlight')
  }

  // 取消高亮节点
  closeHighlight() {
    if (this.group) this.group.removeClass('smm-node-highlight')
  }

  // 伪克隆节点
  // 克隆出的节点并不能真正当做一个节点使用
  fakeClone() {
    const newNode = new MindMapNode({
      ...this.opt,
      uid: createUid()
    })
    Object.keys(this).forEach(item => {
      newNode[item] = this[item]
    })
    return newNode
  }

  // 创建SVG文本节点
  createSvgTextNode(text = '') {
    return new Text().text(text)
  }

  // 获取SVG.js库的一些对象
  getSvgObjects() {
    return {
      SVG,
      G,
      Rect
    }
  }

  // 检查是否支持拖拽调整宽度
  // 1.富文本模式
  // 2.自定义节点内容
  checkEnableDragModifyNodeWidth() {
    const { enableDragModifyNodeWidth, isUseCustomNodeContent, customCreateNodeContent } =
      this.mindMap.opt
    return (
      enableDragModifyNodeWidth &&
      ((this.mindMap as unknown as Record<string, unknown>)['richText'] ||
        (isUseCustomNodeContent && customCreateNodeContent))
    )
  }

  // 是否存在自定义宽度
  hasCustomWidth() {
    return this.checkEnableDragModifyNodeWidth() && this.customTextWidth !== undefined
  }

  // 获取子节点的数量
  getChildrenLength() {
    return this.nodeData.children ? this.nodeData.children.length : 0
  }
}

export default MindMapNode