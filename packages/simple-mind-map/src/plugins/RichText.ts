// @ts-nocheck — vendored engine source
import Quill from 'quill'
import Delta from 'quill-delta'
import 'quill/dist/quill.snow.css'
import {
  walk,
  getTextFromHtml,
  isUndef,
  checkSmmFormatData,
  formatGetNodeGeneralization,
  nodeRichTextToTextWithWrap,
  getNodeRichTextStyles,
  htmlEscape,
  compareVersion
} from '../utils'
import { richTextSupportStyleList } from '../constants/constant'
import MindMapNode from '../core/render/node/MindMapNode'
import { Scope } from 'parchment'

interface MindMapInstance {
  on(event: string, handler: Function, context?: unknown): void
  off(event: string, handler: Function): void
  emit(event: string, ...args: unknown[]): void
  opt: Record<string, unknown> & {
    customInnerElsAppendTo: HTMLElement | null
    nodeTextEditZIndex: string
    textAutoWrapWidth: number
    selectTextOnEnterEditText: boolean
    transformRichTextOnEnterEdit: ((text: string) => string) | undefined
    openRealtimeRenderOnNodeTextEdit: boolean
    autoEmptyTextWhenKeydownEnterEdit: boolean
    beforeHideRichTextEdit: ((instance: RichText) => void) | undefined
    readonly: boolean
    selectTranslateStep: number
    selectTranslateLimit: number
    data?: Record<string, unknown>
  }
  keyCommand: Record<string, unknown> & { stopCheckInSvg(): void; recoveryCheckInSvg(): void }
  renderer: Record<string, unknown> & {
    renderTree: Record<string, unknown> | null
    textEdit: Record<string, unknown> & {
      registerTmpShortcut(): void
      checkIsAutoEnterTextEditKey(e: KeyboardEvent): boolean
      getBackground(node: Record<string, unknown>): string
    }
    findNodeByUid(uid: string): Record<string, unknown> | undefined
  }
  command: Record<string, unknown> & { clearHistory(): void; addHistory(): void }
  execCommand(command: string, ...args: unknown[]): void
  render(): void
  addEditNodeClass(className: string): void
  deleteEditNodeClass(className: string): void
  appendCss(id: string, css: string): void
  removeAppendCss(id: string): void
}

let extended = false

// 扩展quill的字体列表
let fontFamilyList = [
  '宋体, SimSun, Songti SC',
  '微软雅黑, Microsoft YaHei',
  '楷体, 楷体_GB2312, SimKai, STKaiti',
  '黑体, SimHei, Heiti SC',
  '隶书, SimLi',
  'andale mono',
  'arial, helvetica, sans-serif',
  'arial black, avant garde',
  'comic sans ms',
  'impact, chicago',
  'times new roman',
  'sans-serif',
  'serif'
]

// 扩展quill的字号列表
let fontSizeList = new Array(100).fill(0).map((_, index) => {
  return index + 'px'
})

const RICH_TEXT_EDIT_WRAP = 'ql-editor'

// 富文本编辑插件
class RichText {
  static instanceName: string = 'richText'

  declare mindMap: MindMapInstance
  declare pluginOpt: Record<string, unknown> & {
    fontFamilyList?: string[]
    fontSizeList?: string[]
  }
  declare textEditNode: HTMLDivElement | null
  declare showTextEdit: boolean
  declare quill: Quill | null
  declare range: Record<string, unknown> | null
  declare lastRange: Record<string, unknown> | null
  declare pasteUseRange: Record<string, unknown> | null
  declare node: Record<string, unknown> | null
  declare isInserting: boolean
  declare styleEl: HTMLStyleElement | null
  declare cacheEditingText: string
  declare isCompositing: boolean
  declare textNodePaddingX: number
  declare textNodePaddingY: number

  constructor({
    mindMap,
    pluginOpt
  }: {
    mindMap: MindMapInstance
    pluginOpt: Record<string, unknown> & { fontFamilyList?: string[]; fontSizeList?: string[] }
  }) {
    this.mindMap = mindMap
    this.pluginOpt = pluginOpt
    this.textEditNode = null
    this.showTextEdit = false
    this.quill = null
    this.range = null
    this.lastRange = null
    this.pasteUseRange = null
    this.node = null
    this.isInserting = false
    this.styleEl = null
    this.cacheEditingText = ''
    this.isCompositing = false
    this.textNodePaddingX = 6
    this.textNodePaddingY = 4
    this.mindMap.addEditNodeClass(RICH_TEXT_EDIT_WRAP)
    this.initOpt()
    this.extendQuill()
    this.appendCss()
    this.bindEvent()

    this.handleDataToRichTextOnInit()
  }

  // 绑定事件
  bindEvent(): void {
    this.onCompositionStart = this.onCompositionStart.bind(this)
    this.onCompositionUpdate = this.onCompositionUpdate.bind(this)
    this.onCompositionEnd = this.onCompositionEnd.bind(this)
    this.handleSetData = this.handleSetData.bind(this)
    window.addEventListener('compositionstart', this.onCompositionStart)
    window.addEventListener('compositionupdate', this.onCompositionUpdate)
    window.addEventListener('compositionend', this.onCompositionEnd)
    this.mindMap.on('before_update_data', this.handleSetData)
    this.mindMap.on('before_set_data', this.handleSetData)
  }

  // 解绑事件
  unbindEvent(): void {
    window.removeEventListener('compositionstart', this.onCompositionStart)
    window.removeEventListener('compositionupdate', this.onCompositionUpdate)
    window.removeEventListener('compositionend', this.onCompositionEnd)
    this.mindMap.off('before_update_data', this.handleSetData)
    this.mindMap.off('before_set_data', this.handleSetData)
  }

  // 插入样式
  appendCss(): void {
    this.mindMap.appendCss(
      'richText',
      `
      .smm-richtext-node-wrap {
        word-break: break-all;
        user-select: none;
      }

      .ql-editor .ql-align-left, 
      .smm-richtext-node-wrap .ql-align-left {
        text-align: left;
      }

      .smm-richtext-node-wrap .ql-align-right {
        text-align: right;
      }

      .smm-richtext-node-wrap .ql-align-center {
        text-align: center;
      }
      `
    )
    let cssText = `
      .${RICH_TEXT_EDIT_WRAP} {
        overflow: hidden;
        padding: 0;
        height: auto;
        line-height: 1.2;
        -webkit-user-select: text;
        text-align: inherit;
      }
      
      .ql-container {
        height: auto;
        font-size: inherit;
      }

      .ql-container.ql-snow {
        border: none;
      }
    `
    this.styleEl = document.createElement('style')
    this.styleEl.type = 'text/css'
    this.styleEl.innerHTML = cssText
    document.head.appendChild(this.styleEl)
  }

  // 处理选项参数
  initOpt(): void {
    if (this.pluginOpt.fontFamilyList && Array.isArray(this.pluginOpt.fontFamilyList)) {
      fontFamilyList = this.pluginOpt.fontFamilyList
    }
    if (this.pluginOpt.fontSizeList && Array.isArray(this.pluginOpt.fontSizeList)) {
      fontSizeList = this.pluginOpt.fontSizeList
    }
  }

  // 扩展quill编辑器
  extendQuill(): void {
    if (extended) {
      return
    }
    extended = true

    this.extendFont([])

    this.extendAlign()

    // 扩展quill的字号列表
    const SizeAttributor = Quill.import('attributors/class/size')
    ;(SizeAttributor as { whitelist: string[] }).whitelist = fontSizeList
    Quill.register('attributors/class/size', SizeAttributor, true)

    const SizeStyle = Quill.import('attributors/style/size')
    ;(SizeStyle as { whitelist: string[] }).whitelist = fontSizeList
    Quill.register('attributors/style/size', SizeStyle, true)
  }

  // 扩展字体列表
  extendFont(list: string[] = [], cover: boolean = false): void {
    fontFamilyList = cover ? [...list] : [...fontFamilyList, ...list]

    // 扩展quill的字体列表
    const FontAttributor = Quill.import('attributors/class/font')
    ;(FontAttributor as { whitelist: string[] }).whitelist = fontFamilyList
    Quill.register('attributors/class/font', FontAttributor, true)

    const FontStyle = Quill.import('attributors/style/font')
    ;(FontStyle as { whitelist: string[] }).whitelist = fontFamilyList
    Quill.register('attributors/style/font', FontStyle, true)
  }

  // 扩展文本对齐方式
  extendAlign(): void {
    const AlignFormat = Quill.import('formats/align')
    ;(AlignFormat as { whitelist: string[] }).whitelist = ['right', 'center', 'justify', 'left']
    Quill.register('formats/align', AlignFormat, true)
  }

  // 显示文本编辑控件
  showEditText({
    node,
    rect,
    isInserting,
    isFromKeyDown,
    isFromScale
  }: {
    node: Record<string, unknown> & {
      hasCustomWidth(): boolean
      customTextWidth: number
      _textData: Record<string, unknown> & {
        node: { node: HTMLElement; attr(name: string): number }
      }
      getData(key: string): unknown
    }
    rect?: DOMRect
    isInserting?: boolean
    isFromKeyDown?: boolean
    isFromScale?: boolean
  }): void {
    if (this.showTextEdit) {
      return
    }
    let {
      customInnerElsAppendTo,
      nodeTextEditZIndex,
      textAutoWrapWidth,
      selectTextOnEnterEditText,
      transformRichTextOnEnterEdit,
      openRealtimeRenderOnNodeTextEdit,
      autoEmptyTextWhenKeydownEnterEdit
    } = this.mindMap.opt
    textAutoWrapWidth = node.hasCustomWidth() ? node.customTextWidth : textAutoWrapWidth
    this.node = node
    this.isInserting = !!isInserting
    if (!rect) rect = node._textData.node.node.getBoundingClientRect()
    if (!isFromScale) {
      this.mindMap.emit('before_show_text_edit')
    }
    this.mindMap.renderer.textEdit.registerTmpShortcut()
    // 原始宽高
    let g = node._textData.node
    let originWidth = g.attr('data-width')
    let originHeight = g.attr('data-height')
    // 缩放值
    const scaleX = Math.ceil(rect.width) / originWidth
    const scaleY = Math.ceil(rect.height) / originHeight
    // 内边距
    let paddingX = this.textNodePaddingX
    let paddingY = this.textNodePaddingY
    if (!this.textEditNode) {
      this.textEditNode = document.createElement('div')
      this.textEditNode.classList.add('smm-richtext-node-edit-wrap')
      this.textEditNode.style.cssText = `
        position:fixed;
        box-sizing: border-box;
        ${openRealtimeRenderOnNodeTextEdit ? '' : 'box-shadow: 0 0 20px rgba(0,0,0,.5);'}
        outline: none;
        word-break: break-all;
        padding: ${paddingY}px ${paddingX}px;
        line-height: 1.2;
      `
      this.textEditNode.addEventListener('click', (e: Event) => {
        e.stopPropagation()
      })
      this.textEditNode.addEventListener('mousedown', (e: Event) => {
        e.stopPropagation()
      })
      this.textEditNode.addEventListener('keydown', (e: KeyboardEvent) => {
        if (this.mindMap.renderer.textEdit.checkIsAutoEnterTextEditKey(e)) {
          e.stopPropagation()
        }
      })
      const targetNode = customInnerElsAppendTo || document.body
      targetNode.appendChild(this.textEditNode)
    }
    this.addNodeTextStyleToTextEditNode(node)
    this.textEditNode.style.marginLeft = `-${paddingX * scaleX}px`
    this.textEditNode.style.marginTop = `-${paddingY * scaleY}px`
    this.textEditNode.style.zIndex = nodeTextEditZIndex
    if (!openRealtimeRenderOnNodeTextEdit) {
      this.textEditNode.style.background = this.mindMap.renderer.textEdit.getBackground(node)
    }
    this.textEditNode.style.minWidth = originWidth + paddingX * 2 + 'px'
    this.textEditNode.style.minHeight = originHeight + 'px'
    this.textEditNode.style.left = rect.left + 'px'
    this.textEditNode.style.top = rect.top + 'px'
    this.textEditNode.style.display = 'block'
    this.textEditNode.style.maxWidth = textAutoWrapWidth + paddingX * 2 + 'px'
    this.textEditNode.style.transform = `scale(${scaleX}, ${scaleY})`
    this.textEditNode.style.transformOrigin = 'left top'
    // 节点文本内容
    let nodeText = node.getData('text') as string
    if (typeof transformRichTextOnEnterEdit === 'function') {
      nodeText = transformRichTextOnEnterEdit(nodeText)
    }
    // 是否是空文本
    const isEmptyText = isUndef(nodeText)
    // 是否是非空的非富文本
    const noneEmptyNoneRichText = !node.getData('richText') && !isEmptyText
    if (isFromKeyDown && autoEmptyTextWhenKeydownEnterEdit) {
      this.textEditNode.innerHTML = ''
    } else if (noneEmptyNoneRichText) {
      // 还不是富文本
      let text = String(nodeText).split(/\n/gim).join('<br>')
      let html = `<p>${text}</p>`
      this.textEditNode.innerHTML = this.cacheEditingText || html
    } else {
      // 已经是富文本
      this.textEditNode.innerHTML = this.cacheEditingText || nodeText
    }
    this.initQuillEditor()
    this.setQuillContainerMinHeight(originHeight)
    this.setIsShowTextEdit(true)
    // 如果是刚创建的节点，那么默认全选，否则普通激活不全选，除非selectTextOnEnterEditText配置为true
    // 在selectTextOnEnterEditText时，如果是在keydown事件进入的节点编辑，也不需要全选
    this.focus(isInserting || (selectTextOnEnterEditText && !isFromKeyDown) ? 0 : null)
    this.cacheEditingText = ''
  }

  // 当openRealtimeRenderOnNodeTextEdit配置更新后需要更新编辑框样式
  onOpenRealtimeRenderOnNodeTextEditConfigUpdate(openRealtimeRenderOnNodeTextEdit: boolean): void {
    if (!this.textEditNode) return
    this.textEditNode.style.background = openRealtimeRenderOnNodeTextEdit
      ? 'transparent'
      : this.node
        ? this.mindMap.renderer.textEdit.getBackground(this.node)
        : ''
    this.textEditNode.style.boxShadow = openRealtimeRenderOnNodeTextEdit
      ? 'none'
      : '0 0 20px rgba(0,0,0,.5)'
  }

  // 将指定节点的文本样式添加到编辑框元素上
  addNodeTextStyleToTextEditNode(node: Record<string, unknown>): void {
    const style = getNodeRichTextStyles(node)
    Object.keys(style).forEach(prop => {
      if (this.textEditNode) {
        ;(this.textEditNode.style as unknown as Record<string, unknown>)[prop] = style[prop]
      }
    })
  }

  // 设置quill编辑器容器的最小高度
  setQuillContainerMinHeight(minHeight: number): void {
    const el = document.querySelector('.' + RICH_TEXT_EDIT_WRAP) as HTMLElement | null
    if (el) {
      el.style.minHeight = minHeight + 'px'
    }
  }

  // 更新文本编辑框的大小和位置
  updateTextEditNode(): void {
    if (!this.node) return
    const g = (
      this.node as Record<string, unknown> & {
        _textData: { node: { node: HTMLElement; attr(name: string): number } }
      }
    )._textData.node
    const rect = g.node.getBoundingClientRect()
    const originWidth = g.attr('data-width')
    const originHeight = g.attr('data-height')
    if (this.textEditNode) {
      this.textEditNode.style.minWidth = originWidth + this.textNodePaddingX * 2 + 'px'
      this.textEditNode.style.minHeight = originHeight + 'px'
      this.textEditNode.style.left = rect.left + 'px'
      this.textEditNode.style.top = rect.top + 'px'
    }
    this.setQuillContainerMinHeight(originHeight)
  }

  // 删除文本编辑框元素
  removeTextEditEl(): void {
    if (!this.textEditNode) return
    const targetNode = this.mindMap.opt.customInnerElsAppendTo || document.body
    targetNode.removeChild(this.textEditNode)
  }

  // 获取当前正在编辑的内容
  getEditText(): string {
    if (!this.quill || !this.quill.container || !this.quill.container.firstChild) return ''
    // https://github.com/slab/quill/issues/4509
    return (this.quill.container.firstChild as HTMLElement).innerHTML.replace(/  +/g, match =>
      '&nbsp;'.repeat(match.length)
    )
    // 去除ql-cursor节点
    // https://github.com/wanglin2/mind-map/commit/138cc4b3e824671143f0bf70e5c46796f48520d0
    // https://github.com/wanglin2/mind-map/commit/0760500cebe8ec4e8ad84ab63f877b8b2a193aa1
    // html = removeHtmlNodeByClass(html, '.ql-cursor')
    // 去除最后的空行
    // return html.replace(/<p><br><\/p>$/, '')
  }

  // 隐藏文本编辑控件，即完成编辑
  hideEditText(nodes?: Record<string, unknown>[]): void {
    if (!this.showTextEdit) {
      return
    }
    const { beforeHideRichTextEdit } = this.mindMap.opt
    if (typeof beforeHideRichTextEdit === 'function') {
      beforeHideRichTextEdit(this)
    }
    const html = this.getEditText()
    const list = nodes && nodes.length > 0 ? nodes : [this.node as Record<string, unknown>]
    const node = this.node
    if (this.textEditNode) {
      this.textEditNode.style.display = 'none'
    }
    this.setIsShowTextEdit(false)
    this.mindMap.emit('rich_text_selection_change', false)
    this.node = null
    this.isInserting = false
    list.forEach(n => {
      this.mindMap.execCommand('SET_NODE_TEXT', n, html, true)
      // if (node.isGeneralization) {
      // 概要节点
      // node.generalizationBelongNode.updateGeneralization()
      // }
      this.mindMap.render()
    })
    this.mindMap.emit('hide_text_edit', this.textEditNode, list, node)
  }

  // 初始化Quill富文本编辑器
  initQuillEditor(): void {
    if (!this.textEditNode) return
    this.quill = new Quill(this.textEditNode, {
      modules: {
        toolbar: false,
        keyboard: {
          bindings: {
            enter: {
              key: 'Enter',
              handler: function () {
                // 覆盖默认的回车键，禁止换行
              }
            },
            shiftEnter: {
              key: 'Enter',
              shiftKey: true,
              handler: function (range: Record<string, unknown>, context: Record<string, unknown>) {
                // 覆盖默认的换行，默认情况下新行的样式会丢失
                const format = context.format as Record<string, unknown>
                const lineFormats: Record<string, unknown> = Object.keys(format).reduce(
                  (formats: Record<string, unknown>, fmt: string) => {
                    const q = this as {
                      quill: Record<string, unknown> & {
                        scroll: { query(name: string, scope: unknown): unknown }
                      }
                    }
                    if (q.quill.scroll.query(fmt, Scope.BLOCK) && !Array.isArray(format[fmt])) {
                      formats[fmt] = format[fmt]
                    }
                    return formats
                  },
                  {}
                )
                const delta = new Delta()
                  .retain((range as { index: number }).index)
                  .delete((range as { length: number }).length)
                  .insert('\n', lineFormats)
                ;(
                  this as { quill: { updateContents(d: unknown, s: string): void } }
                ).quill.updateContents(delta, Quill.sources.USER)
                ;(
                  this as { quill: { setSelection(i: number, s: string): void } }
                ).quill.setSelection((range as { index: number }).index + 1, Quill.sources.SILENT)
                ;(this as { quill: { focus(): void } }).quill.focus()
                Object.keys(format).forEach(name => {
                  if (lineFormats[name] != null) return
                  if (Array.isArray(format[name])) return
                  if (name === 'code' || name === 'link') return
                  ;(
                    this as { quill: { format(n: string, v: unknown, s: string): void } }
                  ).quill.format(name, format[name], Quill.sources.USER)
                })
              }
            },
            tab: {
              key: 9,
              handler: function () {
                // 覆盖默认的tab键
              }
            }
          }
        }
      },
      formats: [
        'bold',
        'italic',
        'underline',
        'strike',
        'color',
        'background',
        'font',
        'size',
        'formula',
        'align'
      ],
      theme: 'snow'
    })
    // 拦截复制事件，即Ctrl + c，去除多余的空行
    if (this.quill.root) {
      this.quill.root.addEventListener('copy', (event: ClipboardEvent) => {
        event.preventDefault()
        const sel = window.getSelection()
        if (!sel) return
        const originStr = sel.toString()
        try {
          const range = sel.getRangeAt(0)
          const div = document.createElement('div')
          div.appendChild(range.cloneContents())
          const text = nodeRichTextToTextWithWrap(div.innerHTML)
          if (event.clipboardData) {
            event.clipboardData.setData('text/plain', text)
          }
        } catch (e) {
          if (event.clipboardData) {
            event.clipboardData.setData('text/plain', originStr)
          }
        }
      })
    }
    this.quill.on('selection-change', (range: Record<string, unknown> | null) => {
      // 刚创建的节点全选不需要显示操作条
      if (this.isInserting) {
        this.isInserting = false
        return
      }
      this.lastRange = this.range
      this.range = null
      if (range) {
        this.pasteUseRange = range
        let bounds = this.quill!.getBounds(
          (range as { index: number }).index,
          (range as { length: number }).length
        )
        let rect = this.textEditNode!.getBoundingClientRect()
        let rectInfo = {
          left: bounds.left + rect.left,
          top: bounds.top + rect.top,
          right: bounds.right + rect.left,
          bottom: bounds.bottom + rect.top,
          width: bounds.width
        }
        let formatInfo = this.quill!.getFormat(
          (range as { index: number }).index,
          (range as { length: number }).length
        )
        let hasRange = false
        if ((range as { length: number }).length == 0) {
          hasRange = false
        } else {
          this.range = range
          hasRange = true
        }
        this.mindMap.emit('rich_text_selection_change', hasRange, rectInfo, formatInfo)
      } else {
        this.mindMap.emit('rich_text_selection_change', false, null, null)
      }
    })
    this.quill.on('text-change', () => {
      this.mindMap.emit('node_text_edit_change', {
        node: this.node,
        text: this.getEditText(),
        richText: true
      })
    })
    // 拦截粘贴，只允许粘贴纯文本
    if (this.quill.clipboard) {
      this.quill.clipboard.addMatcher(Node.ELEMENT_NODE, (node: Node, delta: Delta) => {
        let ops: Record<string, unknown>[] = []
        let style = this.getPasteTextStyle()
        delta.ops.forEach((op: Record<string, unknown>) => {
          // 过滤出文本内容，过滤掉换行
          if (op.insert && typeof op.insert === 'string') {
            ops.push({
              attributes: { ...style },
              insert: this.formatPasteText(op.insert)
            })
          }
        })
        delta.ops = ops
        return delta
      })
    }
    // 拦截图片的粘贴，当剪贴板里是纯图片，或文本+图片都可以拦截到，但是带来的问题是文本+图片时里面的文本也无法粘贴
    if (this.quill.root) {
      this.quill.root.addEventListener(
        'paste',
        (e: ClipboardEvent) => {
          if (e.clipboardData && e.clipboardData.files && e.clipboardData.files.length) {
            e.preventDefault()
          }
        },
        true
      )
    }
  }

  // 获取粘贴的文本的样式
  getPasteTextStyle(): Record<string, unknown> {
    // 粘贴的数据使用当前光标位置处的文本样式
    if (this.pasteUseRange && this.quill) {
      return this.quill.getFormat(
        (this.pasteUseRange as { index: number }).index,
        (this.pasteUseRange as { length: number }).length
      )
    }
    return {}
  }

  // 处理粘贴的文本内容
  formatPasteText(text: string): string {
    const { isSmm, data } = checkSmmFormatData(text)
    if (isSmm && data[0] && data[0].data) {
      // 只取第一个节点的纯文本
      return getTextFromHtml(data[0].data.text)
    } else {
      return text
    }
  }

  // 正则输入中文
  onCompositionStart(): void {
    if (!this.showTextEdit) {
      return
    }
    this.isCompositing = true
  }

  // 中文输入中
  onCompositionUpdate(): void {
    if (!this.showTextEdit || !this.node) return
    this.mindMap.emit('node_text_edit_change', {
      node: this.node,
      text: this.getEditText(),
      richText: true
    })
  }

  // 中文输入结束
  onCompositionEnd(): void {
    if (!this.showTextEdit) {
      return
    }
    this.isCompositing = false
  }

  // 设置文本编辑框是否处于显示状态
  setIsShowTextEdit(val: boolean): void {
    this.showTextEdit = val
    if (val) {
      this.mindMap.keyCommand.stopCheckInSvg()
    } else {
      this.mindMap.keyCommand.recoveryCheckInSvg()
    }
  }

  // 选中全部
  selectAll(): void {
    if (!this.quill) return
    this.quill.setSelection(0, this.quill.getLength())
  }

  // 聚焦
  focus(start: number | null): void {
    if (!this.quill) return
    const len = this.quill.getLength()
    this.quill.setSelection(typeof start === 'number' ? start : len, len)
  }

  // 格式化当前选中的文本
  formatText(config: Record<string, unknown> = {}, clear: boolean = false): void {
    if (!this.range && !this.lastRange) return
    const rangeLost = !this.range
    const range = rangeLost ? this.lastRange : this.range
    if (!this.quill || !range) return
    if (clear) {
      this.quill.removeFormat(
        (range as { index: number }).index,
        (range as { length: number }).length
      )
    } else {
      const { align, ...rest } = config
      // 文本对齐需要对行进行格式化
      if (align) {
        this.quill.formatLine(
          (range as { index: number }).index,
          (range as { length: number }).length,
          'align',
          align
        )
      }
      // 其他内容对文本
      if (Object.keys(rest).length > 0) {
        this.quill.formatText(
          (range as { index: number }).index,
          (range as { length: number }).length,
          rest
        )
      }
    }
    if (rangeLost) {
      this.quill.setSelection(
        (this.lastRange as { index: number }).index,
        (this.lastRange as { length: number }).length
      )
    }
  }

  // 清除当前选中文本的样式
  removeFormat(): void {
    this.formatText({}, true)
  }

  // 格式化指定范围的文本
  formatRangeText(range: Record<string, unknown>, config: Record<string, unknown> = {}): void {
    if (!range || !this.quill) return
    this.quill.formatText(
      (range as { index: number }).index,
      (range as { length: number }).length,
      config
    )
  }

  // 格式化所有文本
  formatAllText(config: Record<string, unknown> = {}): void {
    if (!this.quill) return
    this.quill.formatText(0, this.quill.getLength(), config)
  }

  // 将普通节点样式对象转换成富文本样式对象
  normalStyleToRichTextStyle(style: Record<string, unknown>): Record<string, unknown> {
    const config: Record<string, unknown> = {}
    Object.keys(style).forEach(prop => {
      const value = style[prop]
      switch (prop) {
        case 'fontFamily':
          config.font = value
          break
        case 'fontSize':
          config.size = value + 'px'
          break
        case 'fontWeight':
          config.bold = value === 'bold'
          break
        case 'fontStyle':
          config.italic = value === 'italic'
          break
        case 'textDecoration':
          config.underline = value === 'underline'
          config.strike = value === 'line-through'
          break
        case 'color':
          config.color = value
          break
        case 'textAlign':
          config.align = value
          break
        default:
          break
      }
    })
    return config
  }

  // 将富文本样式对象转换成普通节点样式对象
  richTextStyleToNormalStyle(config: Record<string, unknown>): Record<string, unknown> {
    const data: Record<string, unknown> = {}
    Object.keys(config).forEach(prop => {
      const value = config[prop]
      switch (prop) {
        case 'font':
          data.fontFamily = value
          break
        case 'size':
          data.fontSize = parseFloat(value as string)
          break
        case 'bold':
          data.fontWeight = value ? 'bold' : 'normal'
          break
        case 'italic':
          data.fontStyle = value ? 'italic' : 'normal'
          break
        case 'underline':
          data.textDecoration = value ? 'underline' : 'none'
          break
        case 'strike':
          data.textDecoration = value ? 'line-through' : 'none'
          break
        case 'color':
          data.color = value
          break
        case 'align':
          data.textAlign = value
          break
        default:
          break
      }
    })
    return data
  }

  // 判断一个对象是否包含了富文本支持的样式字段
  isHasRichTextStyle(obj: Record<string, unknown>): boolean {
    const keys = Object.keys(obj)
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i]
      if (richTextSupportStyleList.includes(key)) {
        return true
      }
    }
    return false
  }

  // 检查指定节点是否存在自定义的富文本样式
  checkNodeHasCustomRichTextStyle(node: Record<string, unknown>): boolean {
    const nodeData = node instanceof MindMapNode ? node.getData() : node
    for (let i = 0; i < richTextSupportStyleList.length; i++) {
      if ((nodeData as Record<string, unknown>)[richTextSupportStyleList[i]] !== undefined) {
        return true
      }
    }
    return false
  }

  // 转换数据后的渲染操作
  afterHandleData(): void {
    // 清空历史数据，并且触发数据变化
    this.mindMap.command.clearHistory()
    this.mindMap.command.addHistory()
    this.mindMap.render()
  }

  // 插件实例化时处理思维导图数据，转换为富文本数据
  handleDataToRichTextOnInit(): void {
    // 处理数据，转成富文本格式
    if (this.mindMap.renderer.renderTree) {
      // 如果已经存在渲染树了，那么直接更新渲染树，并且触发重新渲染
      this.handleSetData(this.mindMap.renderer.renderTree)
      this.afterHandleData()
    } else if (this.mindMap.opt.data) {
      this.handleSetData(this.mindMap.opt.data)
    }
  }

  // 将所有节点转换成非富文本节点
  transformAllNodesToNormalNode(): void {
    const renderTree = this.mindMap.renderer.renderTree
    if (!renderTree) return
    walk(
      renderTree,
      null,
      (node: Record<string, unknown> & { data: Record<string, unknown> }) => {
        if (node.data.richText) {
          node.data.richText = false
          node.data.text = getTextFromHtml(node.data.text as string)
        }
        // 概要
        if (node.data) {
          const generalizationList = formatGetNodeGeneralization(node.data)
          generalizationList.forEach(item => {
            item.richText = false
            item.text = getTextFromHtml(item.text as string)
          })
        }
      },
      null,
      true,
      0,
      0
    )
    this.afterHandleData()
  }

  handleDataToRichText(data: Record<string, unknown>): void {
    const oldIsRichText = data.richText
    data.richText = true
    data.resetRichText = true
    // 如果原本就是富文本，那么不能转换
    if (!oldIsRichText) {
      data.text = htmlEscape(data.text as string)
    }
  }

  // 处理导入数据
  handleSetData(data: Record<string, unknown>): Record<string, unknown> {
    if (!data) return data
    // 短期处理，为了兼容老数据，长期会去除
    const isOldRichTextVersion =
      !data.smmVersion || compareVersion(data.smmVersion as string, '0.13.0') === '<'
    const walkFn = (
      root: Record<string, unknown> & {
        data?: Record<string, unknown>
        children?: Record<string, unknown>[]
      }
    ) => {
      if (root.data && (!root.data.richText || isOldRichTextVersion)) {
        this.handleDataToRichText(root.data)
      }
      // 概要
      if (root.data) {
        const generalizationList = formatGetNodeGeneralization(root.data)
        generalizationList.forEach(item => {
          if (!item.richText || isOldRichTextVersion) {
            this.handleDataToRichText(item)
          }
        })
      }
      if (root.children && root.children.length > 0) {
        Array.from(root.children).forEach(item => {
          walkFn(item)
        })
      }
    }
    walkFn(data)
    return data
  }

  // 插件被移除前做的事情
  beforePluginRemove(): void {
    this.transformAllNodesToNormalNode()
    if (this.styleEl) document.head.removeChild(this.styleEl)
    this.unbindEvent()
    this.mindMap.removeAppendCss('richText')
    this.mindMap.deleteEditNodeClass(RICH_TEXT_EDIT_WRAP)
  }

  // 插件被卸载前做的事情
  beforePluginDestroy(): void {
    if (this.styleEl) document.head.removeChild(this.styleEl)
    this.unbindEvent()
    this.mindMap.deleteEditNodeClass(RICH_TEXT_EDIT_WRAP)
  }
}

export default RichText