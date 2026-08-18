import MindMap from 'simple-mind-map'
import Search from 'simple-mind-map/src/plugins/Search'
import Select from 'simple-mind-map/src/plugins/Select'
import Drag from 'simple-mind-map/src/plugins/Drag'
import Export from 'simple-mind-map/src/plugins/Export'
import ExportPDF from 'simple-mind-map/src/plugins/ExportPDF'
import KeyboardNavigation from 'simple-mind-map/src/plugins/KeyboardNavigation'
import TouchEvent from 'simple-mind-map/src/plugins/TouchEvent'
import Scrollbar from 'simple-mind-map/src/plugins/Scrollbar'
import Cooperate from 'simple-mind-map/src/plugins/Cooperate'
import Comment from 'simple-mind-map/src/plugins/Comment'
import ExportXMind from 'simple-mind-map/src/plugins/ExportXMind'
import { attachGhostCompletion } from '@zoeymind-ext-mind'

/**
 * 当前组织 ID —— 组件 (`MindMapCanvas`) 在 `currentOrg?.id` 变化时调用本函数.
 *
 * 消费方是可选的 ghost completion 插件 (由扩展模块通过 `attachGhostCompletion`
 * 注入). 未安装时没有 ghost 插件时, `attachGhostCompletion` 为 `undefined`, 该值仅
 * 在此模块内保留但没有读取者.
 */
let _currentOrganizationId: string | undefined

export function setCurrentOrganizationId(orgId: string | undefined) {
  _currentOrganizationId = orgId
}

export const initPlugins = () => {
  // 注册插件
  // Note: MindMap.usePlugin is NOT a React Hook, it's a static method for plugin registration
  // eslint-disable-next-line react-hooks/rules-of-hooks
  MindMap.usePlugin(Search)
  // eslint-disable-next-line react-hooks/rules-of-hooks
  MindMap.usePlugin(Select)
  // eslint-disable-next-line react-hooks/rules-of-hooks
  MindMap.usePlugin(Drag)
  // eslint-disable-next-line react-hooks/rules-of-hooks
  MindMap.usePlugin(Export)
  // eslint-disable-next-line react-hooks/rules-of-hooks
  MindMap.usePlugin(ExportPDF)
  // eslint-disable-next-line react-hooks/rules-of-hooks
  MindMap.usePlugin(KeyboardNavigation)
  // eslint-disable-next-line react-hooks/rules-of-hooks
  MindMap.usePlugin(TouchEvent)
  // eslint-disable-next-line react-hooks/rules-of-hooks
  MindMap.usePlugin(Scrollbar)
  // eslint-disable-next-line react-hooks/rules-of-hooks
  MindMap.usePlugin(Cooperate)
  // eslint-disable-next-line react-hooks/rules-of-hooks
  MindMap.usePlugin(Comment)
  // eslint-disable-next-line react-hooks/rules-of-hooks
  MindMap.usePlugin(ExportXMind)
  // 扩展模块提供 ghost completion 时挂上, 否则跳过.
  if (attachGhostCompletion) {
    attachGhostCompletion(MindMap, () => _currentOrganizationId)
  }
}
