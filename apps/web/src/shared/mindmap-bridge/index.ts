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


// === 桌面端 projectDB 桥接 ===
// 老 TopBar / ProjectCard 里读 `projectDB.getProject(id)` 取标题、`updateProject` 改标题.
// 桌面端把这层桥回真实数据源:
//   - pending (未保存新建) -> pendingProjects.read
//   - 已入库                -> SqlProjectRepo (getProject)
//   - updateProject         -> SqlProjectRepo.refreshProjectIndex + pendingProjects 侧同步
// 之前是 Proxy 全 no-op, 直接返回 null, 导致 TopBar 拿不到标题, 新建项目
// 顶栏永远显示 "无标题".
import { getProject, refreshProjectIndex, pendingProjects } from '@/shared/native'

export const projectDB = {
  getProject: async (id: string) => {
    if (!id) return null
    if (pendingProjects.isPending(id)) {
      const p = pendingProjects.read(id)
      return p
        ? { id, name: p.title, updatedAt: p.createdAt, createdAt: p.createdAt }
        : null
    }
    const row = await getProject(id)
    return row
      ? { id: row.id, name: row.name, updatedAt: row.updatedAt, createdAt: row.createdAt }
      : null
  },
  updateProject: async (id: string, patch: { name?: string; nodeCount?: number }) => {
    if (!id) return false
    if (pendingProjects.isPending(id)) {
      if (patch.name) pendingProjects.rename(id, patch.name)
      return true
    }
    await refreshProjectIndex(id, {
      name: patch.name,
      nodeCount: patch.nodeCount
    })
    return true
  },
  // 剩余方法 (getProjectStats / snapshots.* 等) 仍 no-op — dormant UI 用不到.
  snapshots: new Proxy({}, { get: () => async () => null })
} as unknown as Record<string, unknown>

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
