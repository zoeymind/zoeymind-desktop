/**
 * AwarenessSync - 协作者状态同步（cursor / 节点高亮 / 头像）
 *
 * 核心原则：
 *   1. awareness 的本地 key 固定为 'user'，不再用 name/id 作为 key —— 避免用户改名/同名冲突
 *   2. 远端状态通过 awareness.getStates() Map<clientID, state> 收集，外部稳定 ID 是 clientID
 *   3. 头像/节点高亮 diff 化：仅处理变化的 client，避免 N 用户房间内 N²
 *   4. cursor 字段从 state 中独立读写，零拷贝原子更新
 *
 * 与 Yjs awareness 官方推荐做法一致：clientID 是唯一稳定标识，state 是任意 JSON。
 */
interface MindMapInstance {
  on(event: string, handler: Function): void
  off(event: string, handler: Function): void
  renderer: {
    findNodeByUid(uid: string): Record<string, unknown> | null
  }
}
interface AwarenessLike {
  clientID: number
  getLocalState(): Record<string, unknown> | undefined
  setLocalStateField(key: string, value: unknown): void
  getStates(): Map<number, Record<string, unknown>>
  on(event: string, handler: Function): void
  off(event: string, handler: Function): void
}
interface ProviderLike {
  awareness: AwarenessLike
}
declare class AwarenessSync {
  mindMap: MindMapInstance
  provider: ProviderLike | null
  awareness: AwarenessLike | null
  userInfo: Record<string, unknown> | null
  lastHighlightByClient: Map<
    number,
    {
      userInfo: Record<string, unknown>
      uids: string[]
    }
  >
  waitNodeUidMap: Record<string, Record<string, unknown>>
  currentAwarenessData: Record<string, unknown>
  constructor({ mindMap }: { mindMap: MindMapInstance })
  bind(): void
  unbind(): void
  destroy(): void
  setProvider(provider: unknown): void
  setUserInfo(userInfo: unknown): void
  /**
   * 写入本地 awareness 状态。固定 key='user'，state 是任意 JSON。
   */
  setLocalState(partial?: Record<string, unknown>): void
  onNodeActive(
    _node: unknown,
    nodeList: Array<{
      uid: string
    }>
  ): void
  onNodeTreeRenderEnd(): void
  /**
   * Awareness 变化 - diff 处理而非全量重扫
   *
   * 仅对 `change` 事件触发（state 真正变化），不像 'update' 还会因 keep-alive ping 触发。
   */
  onAwarenessChange({
    added,
    updated,
    removed
  }: {
    added: number[]
    updated: number[]
    removed: number[]
  }): void
  /**
   * cursor 字段独立写入（hot path：pointermove 60-90Hz）
   */
  setCursor(cursor: Record<string, unknown> | null): void
  setProjectTitle(title: string): void
}
export { AwarenessSync }
