/**
 * mindmapDB —— 桌面端 no-op stub。
 *
 * 原产品版本走 IndexedDB (`idb`) 存 mindmap 树 + 视图变换；桌面端已改为
 * .zmind bundle 单文件 + SQLite 索引（`@/shared/native/*`），此文件只保留
 * 老代码里 `mindmapDB.save/load/saveViewData/loadViewData/clear` 的表面调用位，
 * 全部返回默认值 / 空 Promise。
 */
import type { MindMapNodeTree } from 'simple-mind-map'
import { defaultMindmapData } from '@zoeymind/shared'

const NOOP_ASYNC = async (): Promise<void> => undefined

export const mindmapDB = {
  save: async (_data: MindMapNodeTree, _projectId?: string): Promise<void> => NOOP_ASYNC(),
  load: async (_projectId?: string): Promise<MindMapNodeTree> => defaultMindmapData,
  clear: async (_projectId?: string): Promise<void> => NOOP_ASYNC(),
  saveViewData: async (_viewData: unknown, _projectId?: string): Promise<void> => NOOP_ASYNC(),
  loadViewData: async (_projectId?: string): Promise<unknown> => null
}
