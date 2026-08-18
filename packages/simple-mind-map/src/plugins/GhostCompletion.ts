// Ghost completion plugin for simple-mind-map
// Provides suggestion hooks during node text editing

const DEFAULT_DELAY: number = 1000
const DEFAULT_MIN_LENGTH: number = 0
const DEFAULT_SUGGESTION: string = '（模拟补全示例）'

interface GhostNode {
  data?: {
    uid?: string
    text?: string
    icon?: string | string[]
  }
  children?: GhostNode[]
  getData?: (key: string) => unknown
}

interface IndexEntry {
  node: GhostNode
  parent: GhostNode | null
}

interface SimplifiedNode {
  uid: string
  text: string
}

interface ContextPayload {
  nodeUid: string
  text: string
  context: {
    node: SimplifiedNode
    type: string
    module: {
      node: SimplifiedNode
      cases: {
        uid: string
        text: string
        steps: SimplifiedNode[]
      }[]
    } | null
  } | null
}

type SuggestionProviderFn = (payload: ContextPayload) => Promise<string>

const defaultSuggestionProvider: SuggestionProviderFn = async () => DEFAULT_SUGGESTION

const hasIcon = (node: GhostNode | undefined | null, icon: string): boolean => {
  const icons = Array.isArray(node?.data?.icon) ? (node!.data!.icon as string[]) : []
  return icons.includes(icon)
}

const simplifyNode = (node: GhostNode | undefined | null): SimplifiedNode => ({
  uid: node?.data?.uid || '',
  text: node?.data?.text || ''
})

const buildUidIndex = (root: GhostNode | undefined | null): Map<string, IndexEntry> => {
  const index = new Map<string, IndexEntry>()
  if (!root) return index
  const stack: { node: GhostNode; parent: GhostNode | null }[] = [{ node: root, parent: null }]
  while (stack.length > 0) {
    const { node, parent } = stack.pop()!
    if (!node || !node.data) continue
    const uid = node.data.uid
    if (uid) {
      index.set(uid, { node, parent })
    }
    if (node.children && Array.isArray(node.children)) {
      for (let i = node.children.length - 1; i >= 0; i--) {
        stack.push({ node: node.children[i], parent: node })
      }
    }
  }
  return index
}

const findNearestModule = (
  entry: IndexEntry | undefined,
  index: Map<string, IndexEntry>
): IndexEntry | null => {
  let current: IndexEntry | undefined = entry
  while (current) {
    if (hasIcon(current.node, 'sign_2')) {
      return current
    }
    const parentUid = current.parent?.data?.uid
    if (!parentUid) {
      return null
    }
    current = index.get(parentUid) || undefined
  }
  return null
}

const collectModuleCases = (
  node: GhostNode | undefined | null
): { uid: string; text: string; steps: SimplifiedNode[] }[] => {
  if (!node?.children || !Array.isArray(node.children)) {
    return []
  }
  const result: { uid: string; text: string; steps: SimplifiedNode[] }[] = []
  node.children.forEach(child => {
    if (hasIcon(child, 'sign_2')) {
      result.push(...collectModuleCases(child))
      return
    }
    result.push({
      uid: child.data?.uid || '',
      text: child.data?.text || '',
      steps:
        child.children?.map(step => ({
          uid: step.data?.uid || '',
          text: step.data?.text || ''
        })) ?? []
    })
  })
  return result
}

const deriveNodeType = (entryNode: GhostNode, moduleNode: GhostNode | null): string => {
  if (!entryNode) return 'unknown'
  if (moduleNode && entryNode === moduleNode) {
    return 'module'
  }
  if (hasIcon(entryNode, 'sign_2')) {
    return 'module'
  }
  const icons = entryNode.getData
    ? (entryNode.getData('icon') as string | string[])
    : entryNode.data?.icon || []
  if (Array.isArray(icons) && (icons as string[]).some(icon => icon.startsWith('priority_'))) {
    return 'case'
  }
  return 'step'
}

interface MindMapInstance {
  on(event: string, handler: Function): void
  off(event: string, handler: Function): void
  emit(event: string, ...args: unknown[]): void
  renderer: Record<string, unknown> & {
    textEdit: Record<string, unknown> | null
  }
  getData(): Record<string, unknown>
}

interface GhostOpt {
  enabled?: boolean
  delay?: number
  minLength?: number
  suggestionProvider?: SuggestionProviderFn
  onContextLog?: (payload: ContextPayload) => void
  onError?: (error: unknown, payload: ContextPayload) => void
}

interface GhostState {
  currentNode: GhostNode | null
  currentText: string
  ghostText: string
  textEditEl: HTMLElement | null
  timer: ReturnType<typeof setTimeout> | null
}

class GhostCompletionPlugin {
  static instanceName: string = 'ghostCompletion'
  static pluginName: string = 'GhostCompletionPlugin'
  static preload: boolean = false

  private mindMap: MindMapInstance
  private opt: GhostOpt
  private state: GhostState
  private pendingRequestId: number

  constructor({ mindMap, pluginOpt = {} }: { mindMap: MindMapInstance; pluginOpt?: GhostOpt }) {
    this.mindMap = mindMap
    this.opt = {
      enabled: true,
      delay: DEFAULT_DELAY,
      minLength: DEFAULT_MIN_LENGTH,
      suggestionProvider: defaultSuggestionProvider,
      onContextLog: null!,
      onError: null!,
      ...pluginOpt
    }

    this.state = {
      currentNode: null,
      currentText: '',
      ghostText: '',
      textEditEl: null,
      timer: null
    }
    this.pendingRequestId = 0

    this.handleBeforeShow = this.handleBeforeShow.bind(this)
    this.handleTextChange = this.handleTextChange.bind(this)
    this.handleHide = this.handleHide.bind(this)
    this.handleInput = this.handleInput.bind(this)
    this.handleKeyDown = this.handleKeyDown.bind(this)

    this.init()
  }

  init(): void {
    this.mindMap.on('before_show_text_edit', this.handleBeforeShow)
    this.mindMap.on('node_text_edit_change', this.handleTextChange)
    this.mindMap.on('hide_text_edit', this.handleHide)
  }

  setConfig(partial: GhostOpt = {}): void {
    this.opt = {
      ...this.opt,
      ...partial
    }
    if (partial.suggestionProvider) {
      this.setSuggestionProvider(partial.suggestionProvider)
    }
  }

  setSuggestionProvider(fn: SuggestionProviderFn | undefined): void {
    this.opt.suggestionProvider = typeof fn === 'function' ? fn : defaultSuggestionProvider
  }

  handleBeforeShow(): void {
    setTimeout(() => {
      this.attachTextEditEl()
    }, 0)
  }

  handleTextChange(data: { node: GhostNode; text: string }): void {
    if (!this.opt.enabled) return
    this.attachTextEditEl()
    this.state.currentNode = data.node
    this.state.currentText = data.text || ''
    this.clearTimer()
    this.clearGhostText()

    const trimmed = (this.state.currentText || '').trim()
    if (trimmed.length < (this.opt.minLength || 0)) {
      return
    }

    this.scheduleSuggestion()
  }

  handleHide(): void {
    this.clearTimer()
    this.clearGhostText()
    this.detachTextEditEl()
    this.state.currentNode = null
    this.state.currentText = ''
  }

  handleInput(): void {
    this.state.currentText = this.getCurrentEditorText()
    this.clearTimer()
    this.clearGhostText()
    const trimmed = (this.state.currentText || '').trim()
    if (trimmed.length < (this.opt.minLength || 0)) {
      return
    }

    if (!this.isCaretAtEnd()) {
      return
    }

    this.scheduleSuggestion()
  }

  handleKeyDown(e: KeyboardEvent): void {
    if (!this.state.ghostText) return
    if (e.key === 'Tab') {
      e.preventDefault()
      e.stopPropagation()
      this.applyGhostText()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      this.clearGhostText()
    }
  }

  attachTextEditEl(): void {
    const textEdit = (
      this.mindMap?.renderer as Record<string, unknown> & {
        textEdit: Record<string, unknown> | null
      }
    )?.textEdit
    const el =
      (textEdit as Record<string, unknown> & { textEditNode: HTMLElement | null })?.textEditNode ||
      null
    if (!el || el === this.state.textEditEl) {
      return
    }
    this.detachTextEditEl()
    this.state.textEditEl = el
    el.addEventListener('input', this.handleInput)
    el.addEventListener('keydown', this.handleKeyDown)
  }

  detachTextEditEl(): void {
    if (!this.state.textEditEl) return
    this.state.textEditEl.removeEventListener('input', this.handleInput)
    this.state.textEditEl.removeEventListener('keydown', this.handleKeyDown)
    this.state.textEditEl.removeAttribute('data-ghost-text')
    this.state.textEditEl = null
  }

  getCurrentEditorText(): string {
    if (!this.state.textEditEl) return ''
    return this.state.textEditEl.textContent || ''
  }

  scheduleSuggestion(): void {
    this.clearTimer()
    const requestId = ++this.pendingRequestId
    this.state.timer = setTimeout(async () => {
      this.state.timer = null
      if (!this.state.currentNode) return
      const trimmed = (this.state.currentText || '').trim()
      if (trimmed.length < (this.opt.minLength || 0)) return
      if (!this.isCaretAtEnd()) return

      const payload = this.buildContextPayload(this.state.currentNode, trimmed)
      if (typeof this.opt.onContextLog === 'function') {
        try {
          ;(this.opt.onContextLog as (payload: ContextPayload) => void)(payload)
        } catch (error) {
          // ignore log errors
        }
      } else {
        // eslint-disable-next-line no-console
        console.info('[GhostCompletion] context', payload)
      }

      let suggestion = ''
      try {
        const provider: SuggestionProviderFn =
          this.opt.suggestionProvider || defaultSuggestionProvider
        suggestion = (await provider(payload)) || ''
      } catch (error: unknown) {
        if (typeof this.opt.onError === 'function') {
          ;(this.opt.onError as (error: unknown, payload: ContextPayload) => void)(error, payload)
        } else {
          // eslint-disable-next-line no-console
          console.warn('[GhostCompletion] suggestion error', error)
        }
      }

      if (requestId !== this.pendingRequestId) {
        return
      }

      if (!suggestion) {
        this.clearGhostText()
        return
      }
      this.showGhostText(suggestion)
    }, this.opt.delay || DEFAULT_DELAY)
  }

  showGhostText(text: string): void {
    this.state.ghostText = text
    if (this.state.textEditEl) {
      this.state.textEditEl.setAttribute('data-ghost-text', `${text}（按TAB补全）`)
    }
  }

  clearGhostText(): void {
    this.state.ghostText = ''
    if (this.state.textEditEl) {
      this.state.textEditEl.removeAttribute('data-ghost-text')
    }
  }

  applyGhostText(): void {
    if (!this.state.textEditEl || !this.state.ghostText) return
    const el = this.state.textEditEl
    const text = this.state.ghostText

    const selection = window.getSelection()
    if (selection) {
      selection.removeAllRanges()
      const range = document.createRange()
      range.selectNodeContents(el)
      range.collapse(false)
      selection.addRange(range)
    }

    const inserted = this.insertText(el, text)
    if (!inserted) {
      el.textContent = (el.textContent || '') + text
    }

    this.clearGhostText()
    el.dispatchEvent(new Event('input', { bubbles: true }))
  }

  insertText(el: HTMLElement, text: string): boolean {
    try {
      if (document.execCommand) {
        return document.execCommand('insertText', false, text)
      }
    } catch (error) {
      // execCommand may throw in some environments, ignore
    }
    return false
  }

  clearTimer(): void {
    if (this.state.timer) {
      clearTimeout(this.state.timer)
      this.state.timer = null
    }
  }

  isCaretAtEnd(): boolean {
    const el = this.state.textEditEl
    if (!el) return true
    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) {
      return true
    }
    const range = selection.getRangeAt(0)
    if (!range.collapsed || !el.contains(range.startContainer)) {
      return false
    }
    try {
      const preRange = range.cloneRange()
      preRange.selectNodeContents(el)
      preRange.setEnd(range.endContainer, range.endOffset)
      const position = preRange.toString().length
      const total = el.textContent?.length ?? 0
      return position === total
    } catch (error) {
      return false
    }
  }

  buildContextPayload(node: GhostNode, text: string): ContextPayload {
    const uid = (node?.getData as ((key: string) => string) | undefined)?.('uid')
    const snapshot = this.mindMap.getData()
    if (!uid || !snapshot) {
      return {
        nodeUid: uid || '',
        text,
        context: null
      }
    }

    const index = buildUidIndex(snapshot as unknown as GhostNode)
    const entry = index.get(uid)
    if (!entry) {
      return {
        nodeUid: uid,
        text,
        context: null
      }
    }

    const moduleEntry = findNearestModule(entry, index)
    const context: ContextPayload['context'] = {
      node: simplifyNode(entry.node),
      type: deriveNodeType(entry.node, moduleEntry?.node || null),
      module: null
    }

    context.node.text = text

    if (moduleEntry && moduleEntry.node !== entry.node) {
      context.module = {
        node: simplifyNode(moduleEntry.node),
        cases: collectModuleCases(moduleEntry.node)
      }

      if (context.module?.cases?.length) {
        context.module.cases = context.module.cases.map(testCase => {
          if (testCase.uid === context.node.uid) {
            return {
              ...testCase,
              text
            }
          }
          if (testCase.steps?.length) {
            testCase.steps = testCase.steps.map(step => {
              if (step.uid === context.node.uid) {
                return {
                  ...step,
                  text
                }
              }
              return step
            })
          }
          return testCase
        })
      }
    }

    return {
      nodeUid: uid,
      text,
      context
    }
  }

  beforePluginDestroy(): void {
    this.destroy()
  }

  beforePluginRemove(): void {
    this.destroy()
  }

  destroy(): void {
    this.clearTimer()
    this.clearGhostText()
    this.detachTextEditEl()
    this.mindMap.off('before_show_text_edit', this.handleBeforeShow)
    this.mindMap.off('node_text_edit_change', this.handleTextChange)
    this.mindMap.off('hide_text_edit', this.handleHide)
  }
}

export default GhostCompletionPlugin
