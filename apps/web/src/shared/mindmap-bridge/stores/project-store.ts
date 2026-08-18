import { create } from 'zustand'
import { logger } from '@zoeymind/logger'
import { projectDB, type ProjectStats } from '../utils/storage/projectDB'

interface ProjectStore {
  // 项目统计信息缓存
  statsCache: Record<string, ProjectStats>

  // 缓存过期时间 (毫秒)
  cacheTTL: number

  // 上次更新时间记录
  lastUpdated: Record<string, number>

  // 获取项目统计
  getProjectStats: (projectId: string) => ProjectStats

  // 添加消息后更新统计
  updateStatsAfterMessage: (projectId: string) => void

  // 手动刷新单个项目统计
  refreshProjectStats: (projectId: string) => Promise<void>

  // 刷新所有项目统计
  refreshAllStats: () => Promise<void>

  // 检查并清理缓存
  cleanCache: () => void
}

export const useProjectManager = create<ProjectStore>((set, get) => ({
  statsCache: {},
  cacheTTL: 60000, // 默认60秒缓存
  lastUpdated: {},

  // 获取项目统计（优先使用缓存）
  getProjectStats: (projectId: string) => {
    const { statsCache, lastUpdated, cacheTTL } = get()
    const now = Date.now()

    // 有缓存且未过期
    if (
      statsCache[projectId] &&
      lastUpdated[projectId] &&
      now - lastUpdated[projectId] < cacheTTL
    ) {
      return statsCache[projectId]
    }

    // 没有缓存或已过期，尝试后台刷新
    setTimeout(() => {
      get().refreshProjectStats(projectId)
    }, 0)

    // 返回缓存数据或默认值
    return statsCache[projectId] || { messageCount: 0, conversationCount: 0 }
  },

  // 刷新单个项目统计
  refreshProjectStats: async (projectId: string) => {
    try {
      // V1 chat 数据已无活 UI, projectDB.getProjectStats 现固定返回 0
      const stats = await projectDB.getProjectStats(projectId)
      if (!stats) return

      // 更新缓存
      set(state => ({
        statsCache: {
          ...state.statsCache,
          [projectId]: stats
        },
        lastUpdated: {
          ...state.lastUpdated,
          [projectId]: Date.now()
        }
      }))
    } catch (error) {
      logger.error('刷新项目统计失败:', error)
    }
  },

  // 添加消息后更新统计
  updateStatsAfterMessage: (projectId: string) => {
    const { statsCache } = get()

    // 立即更新缓存中的计数（乐观更新）
    if (statsCache[projectId]) {
      set(state => ({
        statsCache: {
          ...state.statsCache,
          [projectId]: {
            ...state.statsCache[projectId],
            messageCount: (state.statsCache[projectId]?.messageCount || 0) + 1
          }
        }
      }))
    }

    // 延迟实际刷新
    setTimeout(() => {
      get().refreshProjectStats(projectId)
    }, 300)
  },

  // 刷新所有项目统计
  refreshAllStats: async () => {
    try {
      // 获取所有项目
      const projects = await projectDB.getProjects()

      // 依次更新每个项目（不并行，避免数据库压力）
      for (const project of projects) {
        await get().refreshProjectStats(project.id)
      }
    } catch (error) {
      logger.error('刷新所有项目统计失败:', error)
    }
  },

  // 清理过期缓存
  cleanCache: () => {
    const { statsCache, lastUpdated, cacheTTL } = get()
    const now = Date.now()
    const newCache = { ...statsCache }
    const newLastUpdated = { ...lastUpdated }

    let hasChanges = false

    // 检查所有缓存项
    Object.keys(lastUpdated).forEach(projectId => {
      if (now - lastUpdated[projectId] > cacheTTL * 5) {
        // 5倍TTL后清除
        delete newCache[projectId]
        delete newLastUpdated[projectId]
        hasChanges = true
      }
    })

    // 只在有变化时更新状态
    if (hasChanges) {
      set({
        statsCache: newCache,
        lastUpdated: newLastUpdated
      })
    }
  }
}))

export default useProjectManager
