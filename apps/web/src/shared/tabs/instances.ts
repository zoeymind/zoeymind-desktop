/**
 * Tab-scoped mindmap instances 注册表.
 *
 * 每个已 mount 的 EditorPane 都把它的 MindMap 引擎实例注册到这里 (key=tabId).
 * WorkspaceShell 监听 activeId 变化时, 从这里取当前 tab 的实例, 塞进
 * 全局 useMindMapStore.mindMap; 非活动 tab 的实例仍在 DOM 里 (SVG 保留),
 * 不进全局 store, 避免多 tab 相互抢占.
 *
 * 同时提供 per-tab dirty state 缓存: 切 tab 时把全局 store 的 isDirty
 * 保存到当前 tab, 加载目标 tab 的 isDirty.
 */
type MindMap = unknown

const instanceMap = new Map<string, MindMap>()
const dirtyMap = new Map<string, boolean>()

export const tabInstances = {
  register(tabId: string, instance: MindMap): void {
    instanceMap.set(tabId, instance)
  },
  unregister(tabId: string): void {
    instanceMap.delete(tabId)
    dirtyMap.delete(tabId)
  },
  get(tabId: string | undefined | null): MindMap | undefined {
    if (!tabId) return undefined
    return instanceMap.get(tabId)
  },
  has(tabId: string): boolean {
    return instanceMap.has(tabId)
  }
}

export const tabDirty = {
  set(tabId: string, dirty: boolean): void {
    dirtyMap.set(tabId, dirty)
  },
  get(tabId: string | undefined | null): boolean {
    if (!tabId) return false
    return dirtyMap.get(tabId) ?? false
  }
}

/**
 * Per-tab save handles. EditorPaneInner 挂载时注册, 关闭 (含"保存并关闭") 通过此
 * 桥调用对应 tab 的 save (不必先 setActive).
 */
export interface TabSaveHandle {
  save: () => Promise<void>
  saveAs: (path: string) => Promise<void>
}

const saveFnMap = new Map<string, TabSaveHandle>()

export const tabSaveFns = {
  register(tabId: string, handle: TabSaveHandle): void {
    saveFnMap.set(tabId, handle)
  },
  unregister(tabId: string): void {
    saveFnMap.delete(tabId)
  },
  get(tabId: string | undefined | null): TabSaveHandle | undefined {
    if (!tabId) return undefined
    return saveFnMap.get(tabId)
  }
}
