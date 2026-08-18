// @ts-nocheck — vendored engine source
import {
  bfsWalk,
  getTextFromHtml,
  isUndef,
  replaceHtmlText,
  formatGetNodeGeneralization
} from '../utils/index'
import MindMapNode from '../core/render/node/MindMapNode'
import { CONSTANTS } from '../constants/constant'

interface MindMapInstance {
  on(event: string, handler: Function): void
  off(event: string, handler: Function): void
  emit(event: string, ...args: unknown[]): void
  opt: Record<string, unknown> & { readonly: boolean; isOnlySearchCurrentRenderNodes: boolean }
  renderer: Record<string, unknown> & {
    root: Record<string, unknown>
    renderTree: Record<string, unknown>
    findNodeByUid(uid: string): Record<string, unknown> | undefined
    setNodeDataRender(
      node: Record<string, unknown>,
      data: Record<string, unknown>,
      flag: boolean
    ): void
  }
  command: Record<string, unknown> & { addHistory(): void }
  keyCommand: Record<string, unknown> & { stopCheckInSvg(): void; recoveryCheckInSvg(): void }
  execCommand(command: string, ...args: unknown[]): void
  render(): void
}

// 搜索插件
class Search {
  static instanceName: string = 'search'
  declare mindMap: MindMapInstance
  declare isSearching: boolean
  declare searchText: string
  declare matchNodeList: Record<string, unknown>[]
  declare currentIndex: number
  declare notResetSearchText: boolean
  declare isJumpNext: boolean

  //  构造函数
  constructor({ mindMap }: { mindMap: MindMapInstance }) {
    this.mindMap = mindMap
    // 是否正在搜索
    this.isSearching = false
    // 搜索文本
    this.searchText = ''
    // 匹配的节点列表
    this.matchNodeList = []
    // 当前所在的节点列表索引
    this.currentIndex = -1
    // 不要复位搜索文本
    this.notResetSearchText = false
    // 是否自动跳转下一个匹配节点
    this.isJumpNext = false

    this.bindEvent()
  }

  bindEvent(): void {
    this.onDataChange = this.onDataChange.bind(this)
    this.onModeChange = this.onModeChange.bind(this)
    this.mindMap.on('data_change', this.onDataChange)
    this.mindMap.on('mode_change', this.onModeChange)
  }

  unBindEvent(): void {
    this.mindMap.off('data_change', this.onDataChange)
    this.mindMap.off('mode_change', this.onModeChange)
  }

  // 节点数据改变了，需要重新搜索
  onDataChange(): void {
    if (this.isJumpNext) {
      this.isJumpNext = false
      this.search(this.searchText)
      return
    }
    if (this.notResetSearchText) {
      this.notResetSearchText = false
      return
    }
    this.searchText = ''
  }

  // 监听只读模式切换
  onModeChange(mode: string): void {
    const isReadonly = mode === CONSTANTS.MODE.READONLY
    // 如果是由只读模式切换为非只读模式，需要清除只读模式下的节点高亮
    if (!isReadonly && this.isSearching && this.matchNodeList[this.currentIndex]) {
      ;(
        this.matchNodeList[this.currentIndex] as Record<string, unknown> & {
          closeHighlight(): void
        }
      ).closeHighlight()
    }
  }

  // 搜索
  search(text: string, callback: () => void = () => {}): void {
    if (isUndef(text)) {
      this.endSearch()
      return
    }
    text = String(text)
    this.isSearching = true
    if (this.searchText === text) {
      // 和上一次搜索文本一样，那么搜索下一个
      this.searchNext(callback)
    } else {
      // 和上次搜索文本不一样，那么重新开始
      this.searchText = text
      this.doSearch()
      this.searchNext(callback)
    }
    this.emitEvent()
  }

  // 更新匹配节点列表
  updateMatchNodeList(list: Record<string, unknown>[]): void {
    this.matchNodeList = list
    this.mindMap.emit('search_match_node_list_change', list)
  }

  // 结束搜索
  endSearch(): void {
    if (!this.isSearching) return
    if (this.mindMap.opt.readonly && this.matchNodeList[this.currentIndex]) {
      ;(
        this.matchNodeList[this.currentIndex] as Record<string, unknown> & {
          closeHighlight(): void
        }
      ).closeHighlight()
    }
    this.searchText = ''
    this.updateMatchNodeList([])
    this.currentIndex = -1
    this.notResetSearchText = false
    this.isSearching = false
    this.emitEvent()
  }

  // 搜索匹配的节点
  doSearch(): void {
    this.clearHighlightOnReadonly()
    this.updateMatchNodeList([])
    this.currentIndex = -1
    const { isOnlySearchCurrentRenderNodes } = this.mindMap.opt
    // 如果要搜索收起来的节点，那么要遍历渲染树而不是节点树
    const tree = isOnlySearchCurrentRenderNodes
      ? this.mindMap.renderer.root
      : this.mindMap.renderer.renderTree
    if (!tree) return
    const matchList: Record<string, unknown>[] = []
    bfsWalk(tree, (node: Record<string, unknown>) => {
      let { richText, text, generalization } = isOnlySearchCurrentRenderNodes
        ? (
            node as Record<string, unknown> & { getData(key: string): Record<string, unknown> }
          ).getData('xxx')
        : (node as { data: Record<string, unknown> }).data
      if (richText) {
        text = getTextFromHtml(text)
      }
      if ((text as string).includes(this.searchText)) {
        matchList.push(node)
      }
      // 概要节点
      const generalizationList = formatGetNodeGeneralization({
        generalization
      })
      generalizationList.forEach((gNode: Record<string, unknown>) => {
        let { richText, text, uid } = gNode
        if (isOnlySearchCurrentRenderNodes && !this.mindMap.renderer.findNodeByUid(uid as string)) {
          return
        }
        if (richText) {
          text = getTextFromHtml(text)
        }
        if ((text as string).includes(this.searchText)) {
          matchList.push({
            data: gNode
          })
        }
      })
    })
    this.updateMatchNodeList(matchList)
  }

  // 判断对象是否是节点实例
  isNodeInstance(node: Record<string, unknown>): boolean {
    return node instanceof MindMapNode
  }

  // 搜索下一个或指定索引，定位到下一个匹配节点
  searchNext(callback: () => void, index?: number): void {
    if (!this.isSearching || this.matchNodeList.length <= 0) return
    if (
      index !== undefined &&
      Number.isInteger(index) &&
      index >= 0 &&
      index < this.matchNodeList.length
    ) {
      this.currentIndex = index
    } else {
      if (this.currentIndex < this.matchNodeList.length - 1) {
        this.currentIndex++
      } else {
        this.currentIndex = 0
      }
    }
    const { readonly } = this.mindMap.opt
    // 只读模式下需要清除之前节点的高亮
    this.clearHighlightOnReadonly()
    const currentNode = this.matchNodeList[this.currentIndex]
    this.notResetSearchText = true
    const uid = this.isNodeInstance(currentNode)
      ? (currentNode as Record<string, unknown> & { getData(key: string): string }).getData('uid')
      : (currentNode as { data: { uid: string } }).data.uid
    if (!uid) {
      callback()
      return
    }
    const targetNode = this.mindMap.renderer.findNodeByUid(uid)
    this.mindMap.execCommand('GO_TARGET_NODE', uid, (node: Record<string, unknown>) => {
      if (!this.isNodeInstance(currentNode)) {
        this.matchNodeList[this.currentIndex] = node
        this.updateMatchNodeList(this.matchNodeList)
      }
      callback()
      // 只读模式下节点无法激活，所以通过高亮的方式
      if (readonly) {
        ;(node as Record<string, unknown> & { highlight(): void }).highlight()
      }
      // 如果当前节点实例已经存在，则不会触发data_change事件，那么需要手动把标志复位
      if (targetNode) {
        this.notResetSearchText = false
      }
    })
  }

  // 只读模式下清除现有匹配节点的高亮
  clearHighlightOnReadonly(): void {
    const { readonly } = this.mindMap.opt
    if (readonly) {
      this.matchNodeList.forEach(node => {
        if (this.isNodeInstance(node)) {
          ;(node as Record<string, unknown> & { closeHighlight(): void }).closeHighlight()
        }
      })
    }
  }

  // 定位到指定搜索结果索引的节点
  jump(index: number, callback: () => void = () => {}): void {
    this.searchNext(callback, index)
  }

  // 替换当前节点
  replace(replaceText: string, jumpNext: boolean = false): void {
    if (
      replaceText === null ||
      replaceText === undefined ||
      !this.isSearching ||
      this.matchNodeList.length <= 0
    )
      return
    // 自动跳转下一个匹配节点
    this.isJumpNext = jumpNext
    replaceText = String(replaceText)
    let currentNode = this.matchNodeList[this.currentIndex]
    if (!currentNode) return
    // 如果当前搜索文本是替换文本的子串，那么该节点还是符合搜索结果的
    const keep = replaceText.includes(this.searchText)
    const text = this.getReplacedText(currentNode, this.searchText, replaceText)
    this.notResetSearchText = true
    ;(
      currentNode as Record<string, unknown> & { setText(text: string, richText: unknown): void }
    ).setText(
      text,
      (currentNode as Record<string, unknown> & { getData(key: string): unknown }).getData(
        'richText'
      )
    )
    if (keep) {
      this.updateMatchNodeList(this.matchNodeList)
      return
    }
    const newList = this.matchNodeList.filter(node => {
      return currentNode !== node
    })
    this.updateMatchNodeList(newList)
    if (this.currentIndex > this.matchNodeList.length - 1) {
      this.currentIndex = -1
    } else {
      this.currentIndex--
    }
    this.emitEvent()
  }

  // 替换所有
  replaceAll(replaceText: string): void {
    if (
      replaceText === null ||
      replaceText === undefined ||
      !this.isSearching ||
      this.matchNodeList.length <= 0
    )
      return
    replaceText = String(replaceText)
    // 如果当前搜索文本是替换文本的子串，那么该节点还是符合搜索结果的
    const keep = replaceText.includes(this.searchText)
    this.notResetSearchText = true
    this.matchNodeList.forEach(node => {
      const text = this.getReplacedText(node, this.searchText, replaceText)
      if (this.isNodeInstance(node)) {
        const data = {
          text
        }
        this.mindMap.renderer.setNodeDataRender(node, data, true)
      } else {
        ;(node as { data: Record<string, unknown> }).data.text = text
      }
    })
    this.mindMap.render()
    this.mindMap.command.addHistory()
    if (keep) {
      this.updateMatchNodeList(this.matchNodeList)
    } else {
      this.endSearch()
    }
  }

  // 转义正则表达式特殊字符
  escapeRegExp(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }

  // 获取某个节点替换后的文本
  getReplacedText(node: Record<string, unknown>, searchText: string, replaceText: string): string {
    let { richText, text } = this.isNodeInstance(node)
      ? (
          node as Record<string, unknown> & {
            getData(key: string): { richText: unknown; text: string }
          }
        ).getData('')
      : (node as { data: { richText: boolean; text: string } }).data
    if (richText) {
      return replaceHtmlText(text, searchText, replaceText)
    } else {
      // 转义搜索文本中的正则表达式特殊字符
      const escapedSearchText = this.escapeRegExp(searchText)
      return text.replace(new RegExp(escapedSearchText, 'g'), replaceText)
    }
  }

  // 发送事件
  emitEvent(): void {
    this.mindMap.emit('search_info_change', {
      currentIndex: this.currentIndex,
      total: this.matchNodeList.length
    })
  }

  // 插件被移除前做的事情
  beforePluginRemove(): void {
    this.unBindEvent()
  }

  // 插件被卸载前做的事情
  beforePluginDestroy(): void {
    this.unBindEvent()
  }
}

export default Search