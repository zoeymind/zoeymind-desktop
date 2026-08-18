interface GhostNode {
  data?: {
    uid?: string
    text?: string
    icon?: string | string[]
  }
  children?: GhostNode[]
  getData?: (key: string) => unknown
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
declare class GhostCompletionPlugin {
  static instanceName: string
  static pluginName: string
  static preload: boolean
  private mindMap
  private opt
  private state
  private pendingRequestId
  constructor({ mindMap, pluginOpt }: { mindMap: MindMapInstance; pluginOpt?: GhostOpt })
  init(): void
  setConfig(partial?: GhostOpt): void
  setSuggestionProvider(fn: SuggestionProviderFn | undefined): void
  handleBeforeShow(): void
  handleTextChange(data: { node: GhostNode; text: string }): void
  handleHide(): void
  handleInput(): void
  handleKeyDown(e: KeyboardEvent): void
  attachTextEditEl(): void
  detachTextEditEl(): void
  getCurrentEditorText(): string
  scheduleSuggestion(): void
  showGhostText(text: string): void
  clearGhostText(): void
  applyGhostText(): void
  insertText(el: HTMLElement, text: string): boolean
  clearTimer(): void
  isCaretAtEnd(): boolean
  buildContextPayload(node: GhostNode, text: string): ContextPayload
  beforePluginDestroy(): void
  beforePluginRemove(): void
  destroy(): void
}
export default GhostCompletionPlugin
