/**
 * mindmap-bridge —— 桌面端瘦身版。
 *
 * 产品仓里这个 bridge 是给 web/kb/qms 共享 mindmap 表面用的。桌面端只有一个
 * mindmap 产品，bridge 已经无意义；仅保留 features/mindmap 内部还在引用的
 * 类型/store/工具的**re-export**，让 import 路径不用大改；其余云端概念
 * （projectDB / mindmapDB IDB / useCloudProjects / Cooperate 类型 / project-store）
 * 从这里下线，产品仓源码里对它们的引用会由本 phase 后续 hook 迁移一一改写。
 */

// === 类型 ===
export type { Position, DropdownState, IconToolbarState, ViewData } from './components/types'

// === 核心 store / state ===
export { useMindMapStore, type MindMapRef, type ExitPreviewCallback } from './stores/mindmap-store'

// === Icon priority utility (纯逻辑，无网络) ===
export {
  extractPriorityFromIcons,
  parsePriorityFromText,
  createPriorityIcons,
  type Priority
} from './ai-chat/tools/mindmap/priority-label'

// === Joyride 引导配置（纯 UI，无网络） ===
export { joyrideStyles, joyrideLocale } from './components/guides/joyrideConfig'

// === 桌面端 dormant stub ===
// 老组件（ProjectCard / ProjectListItem / SnapshotPanel / mindMapExporter / useStorageManager）
// 里对 projectDB / useProjectManager 的引用未迁移；这里给一个空实现兜底避免
// vite pre-transform 时 barrel 缺 export 报错。现役 UI 不再使用这两条路径。
export const projectDB: Record<string, () => Promise<null>> = new Proxy(
  {},
  { get: () => async () => null }
)
export const useProjectManager = () => ({
  getProjectStats: () => ({ nodeCount: 0, chatCount: 0, updatedAt: Date.now() }),
  refreshProjectStats: () => undefined
})
// 类型占位（dormant 老组件 import type ProjectWithStats）
export type ProjectWithStats = {
  id: string
  name: string
  updatedAt: number
  createdAt: number
  metadata?: { starred?: boolean }
  description?: string
}
