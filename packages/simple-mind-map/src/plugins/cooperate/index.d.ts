import type MindMap from '../../index'
import { DocumentSync } from './document-sync'
import { AwarenessSync } from './awareness-sync'
declare class Cooperate {
  opt: {
    mindMap: MindMap
  } & Record<string, unknown>
  mindMap: MindMap
  documentSync: DocumentSync
  awarenessSync: AwarenessSync
  static instanceName: string
  constructor(
    opt: {
      mindMap: MindMap
    } & Record<string, unknown>
  )
  getDoc(): import('yjs').Doc
  /**
   * 🔑 关键方法：标记同步已完成，允许响应本地变更
   * 在 WebsocketProvider 同步完成后调用
   */
  setSyncReady(): void
  setProvider(provider: unknown): void
  setUserInfo(userInfo: unknown): void
  get currentAwarenessData(): Record<string, unknown>
  get waitNodeUidMap(): Record<string, Record<string, unknown>>
  beforePluginRemove(): void
  beforePluginDestroy(): void
  unBindEvent(): void
}
export default Cooperate
