/**
 * Per-tab save handles. EditorPaneInner 挂载时注册, 关闭 (含“保存并关闭”) 通过此
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
  },
}
