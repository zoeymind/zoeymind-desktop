// @ts-nocheck — vendored engine source
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

const LOCAL_STATE_KEY = 'user'

class AwarenessSync {
  declare mindMap: MindMapInstance
  declare provider: ProviderLike | null
  declare awareness: AwarenessLike | null
  declare userInfo: Record<string, unknown> | null
  declare lastHighlightByClient: Map<number, { userInfo: Record<string, unknown>; uids: string[] }>
  declare waitNodeUidMap: Record<string, Record<string, unknown>>
  declare currentAwarenessData: Record<string, unknown>

  constructor({ mindMap }: { mindMap: MindMapInstance }) {
    this.mindMap = mindMap
    this.provider = null
    this.awareness = null
    this.userInfo = null

    // 用 Map<clientID, Set<nodeUid>> 记录每个远端 client 上一帧高亮的节点，便于 diff
    this.lastHighlightByClient = new Map()
    this.waitNodeUidMap = {}

    this.onNodeActive = this.onNodeActive.bind(this)
    this.onNodeTreeRenderEnd = this.onNodeTreeRenderEnd.bind(this)
    this.onAwarenessChange = this.onAwarenessChange.bind(this)
  }

  bind() {
    this.mindMap.on('node_active', this.onNodeActive)
    this.mindMap.on('node_tree_render_end', this.onNodeTreeRenderEnd)
  }

  unbind() {
    this.mindMap.off('node_active', this.onNodeActive)
    this.mindMap.off('node_tree_render_end', this.onNodeTreeRenderEnd)
  }

  destroy() {
    this.unbind()
    if (this.awareness) {
      this.awareness.off('change', this.onAwarenessChange)
    }
    this.provider = null
    this.awareness = null
    this.lastHighlightByClient.clear()
    this.waitNodeUidMap = {}
  }

  setProvider(provider: unknown) {
    if (this.awareness) {
      this.awareness.off('change', this.onAwarenessChange)
    }
    this.provider = (provider || null) as ProviderLike | null
    this.awareness = this.provider ? this.provider.awareness : null

    if (this.awareness) {
      this.awareness.on('change', this.onAwarenessChange)
      this.setLocalState({ nodeIdList: [] })
    }
  }

  setUserInfo(userInfo: unknown) {
    this.userInfo = (userInfo || null) as Record<string, unknown> | null
    if (this.userInfo) {
      this.setLocalState({ nodeIdList: [] })
    }
  }

  /**
   * 写入本地 awareness 状态。固定 key='user'，state 是任意 JSON。
   */
  setLocalState(partial: Record<string, unknown> = {}) {
    if (!this.awareness || !this.userInfo) return
    const local = this.awareness.getLocalState() || {}
    const previous = (local[LOCAL_STATE_KEY] as Record<string, unknown>) || {}
    const next: Record<string, unknown> = {
      ...previous,
      userInfo: { ...this.userInfo },
      ...partial
    }
    if (!Array.isArray(next.nodeIdList)) {
      next.nodeIdList = Array.isArray(previous.nodeIdList) ? previous.nodeIdList : []
    }
    this.awareness.setLocalStateField(LOCAL_STATE_KEY, next)
  }

  onNodeActive(_node: unknown, nodeList: Array<{ uid: string }>) {
    if (!this.userInfo || !this.awareness) return
    this.setLocalState({ nodeIdList: nodeList.map(item => item.uid) })
  }

  onNodeTreeRenderEnd() {
    const keys = Object.keys(this.waitNodeUidMap)
    for (const uid of keys) {
      const node = this.mindMap.renderer.findNodeByUid(uid)
      if (node && typeof (node as Record<string, unknown>).addUser === 'function') {
        ;(node as Record<string, (...args: unknown[]) => unknown>).addUser(this.waitNodeUidMap[uid])
      }
    }
    this.waitNodeUidMap = {}
  }

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
  }) {
    if (!this.awareness) {
      this.lastHighlightByClient.clear()
      this.waitNodeUidMap = {}
      return
    }

    const states = this.awareness.getStates()
    const localClientId = this.awareness.clientID

    // removed: 撤掉旧高亮
    for (const clientId of removed) {
      const prev = this.lastHighlightByClient.get(clientId)
      if (!prev) continue
      const prevInfo = prev.userInfo
      for (const uid of prev.uids) {
        const node = this.mindMap.renderer.findNodeByUid(uid)
        if (node && typeof (node as Record<string, unknown>).removeUser === 'function') {
          ;(node as Record<string, (...args: unknown[]) => unknown>).removeUser(prevInfo)
        }
      }
      this.lastHighlightByClient.delete(clientId)
    }

    // added + updated: 增量更新（先撤旧 highlight，再加新）
    const dirty = added.concat(updated)
    for (const clientId of dirty) {
      // 跳过自己
      if (clientId === localClientId) continue

      const state = states.get(clientId)
      const userState = state && (state[LOCAL_STATE_KEY] as Record<string, unknown>)
      const info = userState && (userState.userInfo as Record<string, unknown>)
      const nextUids =
        userState && Array.isArray(userState.nodeIdList) ? (userState.nodeIdList as string[]) : []

      const prev = this.lastHighlightByClient.get(clientId)
      const prevUids = prev ? prev.uids : []
      const prevInfo = prev ? prev.userInfo : null

      // 撤掉前一帧的高亮
      for (const uid of prevUids) {
        const node = this.mindMap.renderer.findNodeByUid(uid)
        if (
          node &&
          typeof (node as Record<string, unknown>).removeUser === 'function' &&
          prevInfo
        ) {
          ;(node as Record<string, (...args: unknown[]) => unknown>).removeUser(prevInfo)
        }
      }

      // 应用新一帧的高亮
      if (info) {
        for (const uid of nextUids) {
          const node = this.mindMap.renderer.findNodeByUid(uid)
          if (node && typeof (node as Record<string, unknown>).addUser === 'function') {
            ;(node as Record<string, (...args: unknown[]) => unknown>).addUser(info)
          } else if (!node) {
            this.waitNodeUidMap[uid] = info
          }
        }
        this.lastHighlightByClient.set(clientId, { userInfo: info, uids: nextUids })
      } else {
        this.lastHighlightByClient.delete(clientId)
      }
    }
  }

  /**
   * cursor 字段独立写入（hot path：pointermove 60-90Hz）
   */
  setCursor(cursor: Record<string, unknown> | null) {
    if (!this.awareness || !this.userInfo) return
    const local = this.awareness.getLocalState() || {}
    const previous = (local[LOCAL_STATE_KEY] as Record<string, unknown>) || {
      userInfo: { ...this.userInfo },
      nodeIdList: []
    }
    if (cursor === null) {
      if (!previous.cursor) return
      const next: Record<string, unknown> = { ...previous }
      delete next.cursor
      this.awareness.setLocalStateField(LOCAL_STATE_KEY, next)
      return
    }
    this.awareness.setLocalStateField(LOCAL_STATE_KEY, { ...previous, cursor })
  }

  setProjectTitle(title: string) {
    if (!this.awareness || !this.userInfo) return
    this.setLocalState({ projectTitle: title })
  }
}

export { AwarenessSync }