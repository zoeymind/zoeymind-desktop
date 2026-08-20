// @ts-nocheck — vendored engine source
import {
  resizeImgSize,
  removeRichTextStyes,
  checkIsRichText,
  isUndef,
  createForeignObjectNode,
  addXmlns,
  generateColorByContent,
  camelCaseToHyphen,
  getNodeRichTextStyles,
  wrapTextByDom
} from '../../../utils'
import {
  Image as SVGImage,
  SVG,
  A,
  G,
  Rect,
  Text,
  Element as SvgElementType
} from '@svgdotjs/svg.js'
import iconsSvg from '../../../svg/icons'
import { noneRichTextNodeLineHeight } from '../../../constants/constant'

// Helper interface for SVG container elements created via the factory function
interface SvgEl {
  attr(attrs: string | Record<string, unknown>, value?: unknown): this
  addClass(cls: string): this
  size(w: number, h: number): this
  add(el: unknown): this
  on(event: string, handler: (...args: unknown[]) => void): this
  addTo(parent: unknown): this
  fill(color: Record<string, unknown>): this
  stroke(style: Record<string, unknown>): this
  radius(r: number): this
  css(style: Record<string, unknown>): this
  center(x: number, y: number): void
  text(t: string): this
}

// 测量svg文本宽高
const measureText = (text, style) => {
  const g = new G()
  const node = new Text().text(text)
  style.text(node)
  g.add(node)
  return g.bbox()
}

// 标签默认的样式
const defaultTagStyle = {
  radius: 3, // 标签矩形的圆角大小
  fontSize: 12, // 字号，建议文字高度不要大于height
  fill: '', // 标签矩形的背景颜色
  height: 20, // 标签矩形的高度
  paddingX: 8 // 水平内边距，如果设置了width，将忽略该配置
  //width: 30 // 标签矩形的宽度，如果不设置，默认以文字的宽度+paddingX*2为宽度
}

// 获取图片的真实url
// 因为如果注册了NodeBase64ImageStorage插件，那么节点图片字段保存的实际是一个id，所以如果要获取图片真实的url可以通过该方法
function getImageUrl() {
  const img = this.getData('image')
  return (this.mindMap.renderer.renderTree.data.imgMap || {})[img] || img
}

//  创建图片节点
function createImgNode() {
  let img = this.getImageUrl()
  if (!img) {
    return undefined
  }
  img = (this.mindMap.renderer.renderTree.data.imgMap || {})[img] || img
  const imgSize = this.getImgShowSize()
  const node = new SVGImage().load(img).size(...imgSize)
  // 如果指定了加载失败显示的图片，那么加载一下图片检测是否失败
  const { defaultNodeImage } = this.mindMap.opt
  if (defaultNodeImage) {
    const imgEl = new Image()
    imgEl.onerror = () => {
      node.load(defaultNodeImage)
    }
    imgEl.src = img
  }
  if (this.getData('imageTitle')) {
    node.attr('title', this.getData('imageTitle'))
  }
  node.on('click', e => {
    this.mindMap.emit('node_img_click', this, node, e)
  })
  node.on('dblclick', e => {
    this.mindMap.emit('node_img_dblclick', this, e, node)
  })
  node.on('mouseenter', e => {
    this.mindMap.emit('node_img_mouseenter', this, node, e)
  })
  node.on('mouseleave', e => {
    this.mindMap.emit('node_img_mouseleave', this, node, e)
  })
  node.on('mousemove', e => {
    this.mindMap.emit('node_img_mousemove', this, node, e)
  })
  return {
    node,
    width: imgSize[0],
    height: imgSize[1]
  }
}

//  获取图片显示宽高
function getImgShowSize() {
  const { custom, width, height } = this.getData('imageSize')
  // 如果是自定义了图片的宽高，那么不受最大宽高限制
  if (custom) return [width, height]
  return resizeImgSize(
    width,
    height,
    this.mindMap.themeConfig.imgMaxWidth,
    this.mindMap.themeConfig.imgMaxHeight
  )
}

//  创建icon节点
function createIconNode() {
  let _data = this.getData()
  if (!_data.icon || _data.icon.length <= 0) {
    return []
  }
  let iconSize = this.mindMap.themeConfig.iconSize
  return _data.icon.map((item, index) => {
    let src = iconsSvg.getNodeIconListIcon(item, this.mindMap.opt.iconList || [])
    let node = null
    // svg图标
    if (/^<svg/.test(src)) {
      node = SVG(src)
    } else {
      // 图片图标
      node = new SVGImage().load(src)
    }
    node.size(iconSize, iconSize)

    // 设置cursor样式
    node.css('cursor', 'pointer')

    node.on('mousedown', e => {
      e.stopPropagation()
    })

    node.on('click', e => {
      e.stopPropagation()
      this.mindMap.emit('node_icon_click', this, item, e, node)
    })
    node.on('mouseenter', e => {
      // 防止重复触发
      if (node.attr('data-icon-hovered') === 'true') return
      node.attr('data-icon-hovered', 'true')

      // 保存原始transform状态
      const originalTransform = node.transform()
      node.attr('data-original-transform', JSON.stringify(originalTransform))

      // 只有hover时才移到最前面，显示最高层级
      node.front()

      // 使用SVG.js的scale方法从中心放大
      // 明确指定中心点为图标中心
      const size = iconSize
      node.scale(1.3, size / 2, size / 2)

      this.mindMap.emit('node_icon_mouseenter', this, item, e, node)
    })
    node.on('mouseleave', e => {
      // 重置状态
      node.attr('data-icon-hovered', 'false')

      // 恢复原始transform状态
      const originalTransform = node.attr('data-original-transform')
      if (originalTransform) {
        const transform = JSON.parse(originalTransform)
        node.transform(transform)
      } else {
        // 如果没有保存的transform，则重置为单位矩阵
        node.transform({
          scaleX: 1,
          scaleY: 1,
          translateX: 0,
          translateY: 0,
          rotate: 0
        })
      }

      // 恢复原始层级：通过重新排序SVG元素
      const parent = node.parent()
      if (parent) {
        // 获取所有icon节点并按原始索引排序
        const allIcons = []
        parent.children().forEach(child => {
          const originalIndex = child.attr('data-original-index')
          if (originalIndex !== undefined) {
            allIcons.push({
              node: child,
              index: parseInt(originalIndex)
            })
          }
        })

        // 按索引排序（倒序添加，让第一个在最上层）
        allIcons.sort((a, b) => b.index - a.index)

        // 重新添加到父容器中
        allIcons.forEach(iconData => {
          parent.add(iconData.node)
        })
      }

      this.mindMap.emit('node_icon_mouseleave', this, item, e, node)
    })
    return {
      node,
      width: iconSize,
      height: iconSize
    }
  })
}

// 创建富文本节点
function createRichTextNode(specifyText) {
  const hasCustomWidth = this.hasCustomWidth()
  let text = typeof specifyText === 'string' ? specifyText : this.getData('text')
  let { textAutoWrapWidth, emptyTextMeasureHeightText } = this.mindMap.opt
  textAutoWrapWidth = hasCustomWidth ? this.customTextWidth : textAutoWrapWidth

  // 检查是否是用例标题（有 priority_* 图标），如果是则处理 & 后面的文本透明度
  const _data = this.getData()
  const isCaseTitle = _data.icon && _data.icon.some(icon => icon.startsWith('priority_'))

  const g = new G()
  // 创建富文本结构，或复位富文本样式
  let recoverText = false
  if (this.getData('resetRichText')) {
    delete this.nodeData.data.resetRichText
    recoverText = true
  }
  if (recoverText && !isUndef(text)) {
    if (checkIsRichText(text)) {
      // 如果是富文本那么移除内联样式
      text = removeRichTextStyes(text)
    } else {
      // 非富文本则改为富文本结构
      text = `<p>${text}</p>`
    }
    this.setData({
      text
    })
  }
  // 节点的富文本样式数据
  const nodeTextStyleList = []
  const nodeRichTextStyles = getNodeRichTextStyles(this)
  Object.keys(nodeRichTextStyles).forEach(prop => {
    nodeTextStyleList.push([prop, nodeRichTextStyles[prop]])
  })
  // 测量文本大小
  if (!this.mindMap.commonCaches.measureRichtextNodeTextSizeEl) {
    this.mindMap.commonCaches.measureRichtextNodeTextSizeEl = document.createElement('div')
    this.mindMap.commonCaches.measureRichtextNodeTextSizeEl.style.position = 'fixed'
    this.mindMap.commonCaches.measureRichtextNodeTextSizeEl.style.left = '-999999px'
    this.mindMap.el.appendChild(this.mindMap.commonCaches.measureRichtextNodeTextSizeEl)
  }
  const div = this.mindMap.commonCaches.measureRichtextNodeTextSizeEl
  // 应用节点的文本样式
  nodeTextStyleList.forEach(([prop, value]) => {
    div.style[prop] = value
  })
  div.style.lineHeight = 1.2

  // 如果是用例标题且文本包含 " & "（两边有空格），则将其及后面的内容设置为半透明
  let html = `<div>${text}</div>`
  if (isCaseTitle && text.includes(' & ')) {
    const ampIndex = text.indexOf(' & ')
    const beforeText = text.substring(0, ampIndex)
    const afterText = text.substring(ampIndex) // 包含 " & " 及后续内容
    html = `<div>${beforeText}<span style="opacity: 0.5">${afterText}</span></div>`
  }

  div.innerHTML = html
  const el = div.children[0]
  el.classList.add('smm-richtext-node-wrap')
  addXmlns(el)
  el.style.maxWidth = textAutoWrapWidth + 'px'
  if (hasCustomWidth) {
    el.style.width = this.customTextWidth + 'px'
  } else {
    el.style.width = ''
  }
  let { width, height } = el.getBoundingClientRect()
  // 如果文本为空，那么需要计算一个默认高度
  if (height <= 0) {
    div.innerHTML = `<p>${emptyTextMeasureHeightText}</p>`
    let elTmp = div.children[0]
    elTmp.classList.add('smm-richtext-node-wrap')
    height = elTmp.getBoundingClientRect().height
    div.innerHTML = html
  }
  width = Math.min(Math.ceil(width) + 1, textAutoWrapWidth) // 修复getBoundingClientRect方法对实际宽度是小数的元素获取到的值是整数，导致宽度不够文本发生换行的问题
  height = Math.ceil(height)
  g.attr('data-width', width)
  g.attr('data-height', height)
  const foreignObject = createForeignObjectNode({
    el: div.children[0],
    width,
    height
  })
  // 应用节点文本样式
  // 进入文本编辑时，这个样式也会同样添加到文本编辑框的元素上
  const foreignObjectStyle = {
    'line-height': 1.2
  }
  nodeTextStyleList.forEach(([prop, value]) => {
    foreignObjectStyle[camelCaseToHyphen(prop)] = value
  })
  foreignObject.css(foreignObjectStyle)
  g.add(foreignObject)
  return {
    node: g,
    nodeContent: foreignObject,
    width,
    height
  }
}

//  创建文本节点
function createTextNode(specifyText) {
  if (this.getData('needUpdate')) {
    delete this.nodeData.data.needUpdate
  }
  // 如果是富文本内容，那么转给富文本函数
  if (this.getData('richText')) {
    return this.createRichTextNode(specifyText)
  }
  const text = typeof specifyText === 'string' ? specifyText : this.getData('text')
  if (this.getData('resetRichText')) {
    delete this.nodeData.data.resetRichText
  }

  // 检查是否是用例标题（有 priority_* 图标），如果是则处理 & 后面的文本透明度
  const _data = this.getData()
  const isCaseTitle = _data.icon && _data.icon.some(icon => icon.startsWith('priority_'))

  const g = new G()
  const fontSize = this.getStyle('fontSize', false)
  const textAlign = this.getStyle('textAlign', false)
  // 文本超长自动换行
  let textArr = []
  if (!isUndef(text)) {
    textArr = String(text).split(/\n/gim)
  }
  const { textAutoWrapWidth: maxWidth, emptyTextMeasureHeightText } = this.mindMap.opt
  let isMultiLine = textArr.length > 1

  // 用例标题中 " & " 的处理：
  // 找到第一个 " & "（两边有空格），将其之前的文本正常渲染，之后的文本（包括 " & "）半透明渲染
  // 这个标记是跨行的——一旦遇到 " & "，后续所有内容都半透明
  let encounteredAmpersand = false // 跨行跟踪是否已遇到 " & "
  let processedLines = [] // 存储处理后的所有行

  // 换行决策统一走 DOM 排版（wrapTextByDom）。
  // 编辑态是 contenteditable div，SVG 侧复用同一字符断点，避免 canvas 与 DOM
  // 对 CJK/混排文本的逐字度量差异造成换行位置跳动。
  const viewScale = (this.mindMap.view && this.mindMap.view.scale) || 1
  const fontFamilyForWrap = this.getStyle('fontFamily', false)
  const fontWeightForWrap = this.getStyle('fontWeight', false)
  const fontStyleForWrap = this.getStyle('fontStyle', false)
  const measureFontStyle = {
    fontFamily: String(fontFamilyForWrap || ''),
    fontSize: fontSize * viewScale,
    bold:
      fontWeightForWrap === 'bold' ||
      Number(fontWeightForWrap) >= 600,
    italic: fontStyleForWrap === 'italic',
    lineHeight: noneRichTextNodeLineHeight
  }
  const wrapMaxWidthCss = maxWidth * viewScale
  textArr.forEach(item => {
    const wrappedLines = wrapTextByDom(item, wrapMaxWidthCss, measureFontStyle)
    if (wrappedLines.length > 1) {
      isMultiLine = true
    }
    wrappedLines.forEach(line => {
      processedLines.push(line)
    })
  })

  // 使用处理后的行数组
  textArr = processedLines

  textArr.forEach((item, index) => {
    // 避免尾部的空行不占宽度
    if (item === '') {
      item = '\ufeff'
    }

    // 计算文本位置
    const y =
      fontSize * noneRichTextNodeLineHeight * index +
      ((noneRichTextNodeLineHeight - 1) * fontSize) / 2

    // 如果是用例标题，检查当前行是否包含 " & " 分割点
    if (isCaseTitle && !encounteredAmpersand && item.includes(' & ')) {
      const ampersandIndex = item.indexOf(' & ')
      const beforeText = item.substring(0, ampersandIndex)
      const afterText = item.substring(ampersandIndex)
      encounteredAmpersand = true

      const textNode = new Text()
      textNode.addClass('smm-text-node-wrap')
      textNode.attr(
        'text-anchor',
        {
          left: 'start',
          center: 'middle',
          right: 'end'
        }[textAlign] || 'start'
      )
      this.style.text(textNode)
      textNode.text(function (add) {
        if (beforeText) {
          add.tspan(beforeText)
        }
        if (afterText) {
          add.tspan(afterText).attr('fill-opacity', 0.5)
        }
      })
      textNode.y(y)
      g.add(textNode)
    } else {
      const shouldBeHalfOpacity = isCaseTitle && encounteredAmpersand
      const node = new Text().text(item)
      node.addClass('smm-text-node-wrap')
      node.attr(
        'text-anchor',
        {
          left: 'start',
          center: 'middle',
          right: 'end'
        }[textAlign] || 'start'
      )
      this.style.text(node)
      if (shouldBeHalfOpacity) {
        node.attr('fill-opacity', 0.5)
      }
      node.y(y)
      g.add(node)
    }
  })
  let { width, height } = g.bbox()
  // 如果文本为空，那么需要计算一个默认高度
  if (height <= 0) {
    const tmpNode = new Text().text(emptyTextMeasureHeightText)
    this.style.text(tmpNode)
    const tmpBbox = tmpNode.bbox()
    height = tmpBbox.height
  }
  width = Math.min(Math.ceil(width), maxWidth)
  height = Math.ceil(height)
  g.attr('data-width', width)
  g.attr('data-height', height)
  g.attr('data-ismultiLine', isMultiLine || textArr.length > 1)
  return {
    node: g,
    width,
    height
  }
}

//  创建超链接节点
function createHyperlinkNode() {
  const { hyperlink, hyperlinkTitle } = this.getData()
  if (!hyperlink) {
    return undefined
  }
  const { customHyperlinkJump, hyperlinkIcon } = this.mindMap.opt
  const { icon, style } = hyperlinkIcon
  const iconSize = this.getNodeIconSize('hyperlinkIcon')
  const node = new (SVG as unknown as { new (): SvgEl })().size(iconSize, iconSize)
  // 超链接节点
  const a = new A().to(hyperlink).target('_blank')
  a.node.addEventListener('click', e => {
    if (typeof customHyperlinkJump === 'function') {
      e.preventDefault()
      customHyperlinkJump(hyperlink, this)
    }
  })
  if (hyperlinkTitle) {
    node.add(SVG(`<title>${hyperlinkTitle}</title>`))
  }
  // 添加一个透明的层，作为鼠标区域
  a.rect(iconSize, iconSize).fill({ color: 'transparent' })
  // 超链接图标
  const iconNode = SVG(icon || iconsSvg.hyperlink)
  ;(iconNode as unknown as { size(w: number, h: number): unknown }).size(iconSize, iconSize)
  this.style.iconNode(iconNode, style.color)
  a.add(iconNode as unknown as SvgElementType)
  node.add(a)
  return {
    node,
    width: iconSize,
    height: iconSize
  }
}

//  创建标签节点
function createTagNode() {
  const tagData = this.getData('tag')
  if (!tagData || tagData.length <= 0) {
    return []
  }
  let { maxTag, tagsColorMap } = this.mindMap.opt
  tagsColorMap = tagsColorMap || {}
  const nodes = []
  tagData.slice(0, maxTag).forEach((item, index) => {
    let str = ''
    let style = {
      ...defaultTagStyle
    }
    // 旧版只支持字符串类型
    if (typeof item === 'string') {
      str = item
    } else {
      // v0.10.3+版本支持对象类型
      str = item.text
      style = { ...defaultTagStyle, ...item.style }
    }
    // 是否手动设置了标签宽度
    const hasCustomWidth = typeof (style as Record<string, unknown>).width !== 'undefined'
    // 创建容器节点
    const tag = new G()
    tag.on('click', () => {
      this.mindMap.emit('node_tag_click', this, item, index, tag)
    })
    // 标签文本
    const text = new Text().text(str)
    this.style.tagText(text, style)
    // 获取文本宽高
    const { width: textWidth, height: textHeight } = text.bbox()
    // 矩形宽度
    const rectWidth = hasCustomWidth
      ? Number((style as Record<string, number | string>).width)
      : textWidth + style.paddingX * 2
    // 取文本和矩形最大宽高作为标签宽高
    const maxWidth = hasCustomWidth ? Math.max(rectWidth, textWidth) : rectWidth
    const maxHeight = Math.max(style.height, textHeight)
    // 文本居中
    if (hasCustomWidth) {
      text.x((maxWidth - textWidth) / 2)
    } else {
      text.x(hasCustomWidth ? 0 : style.paddingX)
    }
    text.cy(-maxHeight / 2)
    // 标签矩形
    const rect = new Rect().size(rectWidth, style.height).cy(-maxHeight / 2)
    if (hasCustomWidth) {
      rect.x((maxWidth - rectWidth) / 2)
    }
    this.style.tagRect(rect, {
      ...style,
      fill:
        style.fill || // 优先节点自身配置
        tagsColorMap[text.node.textContent] || // 否则尝试从实例化选项tagsColorMap映射中获取颜色
        generateColorByContent(text.node.textContent) // 否则按照标签内容生成
    })
    tag.add(rect).add(text)
    nodes.push({
      node: tag,
      width: maxWidth,
      height: maxHeight
    })
  })
  return nodes
}

//  创建备注节点
function createNoteNode() {
  if (!this.getData('note')) {
    return null
  }
  const { icon, style } = this.mindMap.opt.noteIcon
  const iconSize = this.getNodeIconSize('noteIcon')
  const node = new (SVG as unknown as { new (): SvgEl })()
    .attr('cursor', 'pointer')
    .addClass('smm-node-note')
    .size(iconSize, iconSize)
  // 透明的层，用来作为鼠标区域
  node.add(new Rect().size(iconSize, iconSize).fill({ color: 'transparent' }))
  // 备注图标
  const iconNode = SVG(icon || iconsSvg.note)
  ;(iconNode as unknown as { size(w: number, h: number): unknown }).size(iconSize, iconSize)
  this.style.iconNode(iconNode, style.color)
  node.add(iconNode)
  // 备注tooltip
  if (!this.mindMap.opt.customNoteContentShow) {
    if (!this.noteEl) {
      this.noteEl = document.createElement('div')
      this.noteEl.style.cssText = `
          position: fixed;
          padding: 10px;
          border-radius: 5px;
          box-shadow: 0 2px 5px rgb(0 0 0 / 10%);
          display: none;
          background-color: #fff;
          z-index: ${this.mindMap.opt.nodeNoteTooltipZIndex}
      `
      const targetNode = this.mindMap.opt.customInnerElsAppendTo || document.body
      targetNode.appendChild(this.noteEl)
    }
    this.noteEl.innerText = this.getData('note')
  }
  node.on('mouseover', () => {
    const { left, top } = this.getNoteContentPosition()
    if (!this.mindMap.opt.customNoteContentShow) {
      this.noteEl.style.left = left + 'px'
      this.noteEl.style.top = top + 'px'
      this.noteEl.style.display = 'block'
    } else {
      this.mindMap.opt.customNoteContentShow.show(this.getData('note'), left, top, this)
    }
  })
  node.on('mouseout', () => {
    if (!this.mindMap.opt.customNoteContentShow) {
      this.noteEl.style.display = 'none'
    } else {
      this.mindMap.opt.customNoteContentShow.hide()
    }
  })
  node.on('click', e => {
    this.mindMap.emit('node_note_click', this, e, node)
  })
  node.on('dblclick', e => {
    this.mindMap.emit('node_note_dblclick', this, e, node)
  })
  return {
    node,
    width: iconSize,
    height: iconSize
  }
}

//  创建附件节点
function createAttachmentNode() {
  const { attachmentUrl, attachmentName } = this.getData()
  if (!attachmentUrl) {
    return undefined
  }
  const iconSize = this.getNodeIconSize('attachmentIcon')
  const { icon, style } = this.mindMap.opt.attachmentIcon
  const node = new (SVG as unknown as { new (): SvgEl })()
    .attr('cursor', 'pointer')
    .size(iconSize, iconSize)
  if (attachmentName) {
    node.add(SVG(`<title>${attachmentName}</title>`))
  }
  // 透明的层，用来作为鼠标区域
  node.add(new Rect().size(iconSize, iconSize).fill({ color: 'transparent' }))
  // 备注图标
  const iconNode = SVG(icon || iconsSvg.attachment)
  ;(iconNode as unknown as { size(w: number, h: number): unknown }).size(iconSize, iconSize)
  this.style.iconNode(iconNode, style.color)
  node.add(iconNode)
  node.on('click', e => {
    this.mindMap.emit('node_attachmentClick', this, e, node)
  })
  node.on('contextmenu', e => {
    this.mindMap.emit('node_attachmentContextmenu', this, e, node)
  })
  return {
    node,
    width: iconSize,
    height: iconSize
  }
}

// 创建评论标签节点
function createCommentLabelNode() {
  // 检查是否注册了评论插件
  if (!this.mindMap.comment) {
    return null
  }

  // 获取节点的 UID
  const nodeUid = this.getData('uid')
  if (!nodeUid) {
    return null
  }

  // 从评论插件获取评论信息
  const commentInfo = this.mindMap.comment.getNodeCommentInfo(nodeUid)
  if (!commentInfo || commentInfo.count === 0) {
    return null
  }

  // 从配置中获取样式，如果没有则使用默认值
  const commentStyle = this.mindMap.opt.commentLabelStyle || {}
  const width = Number((commentStyle as Record<string, number>).width) || 24
  const height = Number((commentStyle as Record<string, number>).height) || 20
  const radius = Number((commentStyle as Record<string, number>).radius) || 4
  const fontSize = Number((commentStyle as Record<string, number>).fontSize) || 12
  const bgColor = String((commentStyle as Record<string, string>).bgColor || '#f59e0b')
  const textColor = String((commentStyle as Record<string, string>).textColor || '#fff')

  // 创建容器
  const g = new G()
  g.addClass('smm-comment-label')
  g.css('cursor', 'pointer')

  // 创建背景矩形
  const rect = new Rect().size(width, height).radius(radius)
  rect.fill({ color: bgColor })
  rect.stroke({ color: 'none' })
  rect.css('transition', 'opacity 0.2s ease-in-out')

  // 创建文本（评论数量）
  const text = new Text()
  ;(text as unknown as { text(t: string): unknown }).text(String(commentInfo.count))
  ;(text as unknown as { fill(c: Record<string, unknown>): unknown }).fill({ color: textColor })
  ;(text as unknown as { css(s: Record<string, unknown>): unknown }).css({
    'font-size': fontSize + 'px',
    'font-weight': '500'
  })

  g.add(rect)
  g.add(text)

  // 文本居中
  ;(text as unknown as { attr(a: Record<string, unknown>): void }).attr({
    'text-anchor': 'middle',
    'dominant-baseline': 'middle'
  })
  ;(text as unknown as { center(x: number, y: number): void }).center(width / 2, height / 2)

  // 添加 hover 高亮效果
  g.on('mouseenter', () => {
    rect.attr('opacity', 0.8)
  })
  g.on('mouseleave', () => {
    rect.attr('opacity', 1)
  })

  // 添加点击事件
  g.on('click', e => {
    e.stopPropagation() // 阻止事件冒泡，避免触发节点点击
    this.mindMap.emit('node_comment_label_click', this, commentInfo, e)
  })

  return {
    node: g,
    width,
    height
  }
}

// 获取节点图标大小
function getNodeIconSize(prop) {
  const { style } = this.mindMap.opt[prop]
  return isUndef(style.size) ? this.mindMap.themeConfig.iconSize : style.size
}

// 获取节点备注显示位置
function getNoteContentPosition() {
  const iconSize = this.getNodeIconSize('noteIcon')
  const { scaleY } = this.mindMap.view.getTransformData().transform
  const iconSizeAddScale = iconSize * scaleY
  let { left, top } = this._noteData.node.node.getBoundingClientRect()
  top += iconSizeAddScale
  return {
    left,
    top
  }
}

// 测量自定义节点内容元素的宽高
function measureCustomNodeContentSize(content) {
  if (!this.mindMap.commonCaches.measureCustomNodeContentSizeEl) {
    this.mindMap.commonCaches.measureCustomNodeContentSizeEl = document.createElement('div')
    this.mindMap.commonCaches.measureCustomNodeContentSizeEl.style.cssText = `
      position: fixed;
      left: -99999px;
      top: -99999px;
    `
    this.mindMap.el.appendChild(this.mindMap.commonCaches.measureCustomNodeContentSizeEl)
  }
  this.mindMap.commonCaches.measureCustomNodeContentSizeEl.innerHTML = ''
  this.mindMap.commonCaches.measureCustomNodeContentSizeEl.appendChild(content)
  let rect = this.mindMap.commonCaches.measureCustomNodeContentSizeEl.getBoundingClientRect()
  return {
    width: rect.width,
    height: rect.height
  }
}

// 是否使用的是自定义节点内容
function isUseCustomNodeContent() {
  return !!this._customNodeContent
}

export default {
  getImageUrl,
  createImgNode,
  getImgShowSize,
  createIconNode,
  createRichTextNode,
  createTextNode,
  createHyperlinkNode,
  createTagNode,
  createNoteNode,
  createAttachmentNode,
  createCommentLabelNode,
  getNoteContentPosition,
  getNodeIconSize,
  measureCustomNodeContentSize,
  isUseCustomNodeContent
}