// @ts-nocheck — vendored engine source
// Cooperate 作为协作插件入口，整合文档同步与 awareness 同步
import type MindMap from '../../index'
import { DocumentSync } from './document-sync'
import { AwarenessSync } from './awareness-sync'

class Cooperate {
  declare opt: { mindMap: MindMap } & Record<string, unknown>
  declare mindMap: MindMap
  declare documentSync: DocumentSync
  declare awarenessSync: AwarenessSync
  declare static instanceName: string

  constructor(opt: { mindMap: MindMap } & Record<string, unknown>) {
    this.opt = opt
    this.mindMap = opt.mindMap

    this.documentSync = new DocumentSync({ mindMap: this.mindMap })
    this.awarenessSync = new AwarenessSync({ mindMap: this.mindMap })

    this.documentSync.bind()
    this.awarenessSync.bind()
    // 不做任何数据初始化，数据只来自服务器同步
  }

  getDoc() {
    return this.documentSync.getDoc()
  }

  /**
   * 🔑 关键方法：标记同步已完成，允许响应本地变更
   * 在 WebsocketProvider 同步完成后调用
   */
  setSyncReady() {
    this.documentSync.setSyncReady()
  }

  setProvider(provider: unknown) {
    this.awarenessSync.setProvider(provider)
  }

  setUserInfo(userInfo: unknown) {
    this.awarenessSync.setUserInfo(userInfo)
  }

  get currentAwarenessData() {
    return this.awarenessSync.currentAwarenessData
  }

  get waitNodeUidMap() {
    return this.awarenessSync.waitNodeUidMap
  }

  beforePluginRemove() {
    this.unBindEvent()
  }

  beforePluginDestroy() {
    this.unBindEvent()
  }

  unBindEvent() {
    this.documentSync.destroy()
    this.awarenessSync.destroy()
  }
}

Cooperate.instanceName = 'cooperate'

export default Cooperate