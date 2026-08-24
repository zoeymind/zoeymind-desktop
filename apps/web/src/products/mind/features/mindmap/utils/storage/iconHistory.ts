// 图标历史管理工具
import { logger } from "@zoeymind/logger"
const ICON_HISTORY_KEY = "mindmap_recent_icons"
const MAX_RECENT_ICONS = 8 // 最多保存8个最近使用的图标

export interface RecentIcon {
  type: string
  name: string
  icon: string
  lastUsed: number
}

/**
 * 获取最近使用的图标
 */
export function getRecentIcons(): RecentIcon[] {
  try {
    const stored = localStorage.getItem(ICON_HISTORY_KEY)
    if (!stored) return []

    const icons: RecentIcon[] = JSON.parse(stored)
    // 按最后使用时间排序
    return icons.sort((a, b) => b.lastUsed - a.lastUsed)
  } catch (error) {
    logger.error("获取最近使用图标失败:", error)
    return []
  }
}

/**
 * 添加图标到历史记录
 */
export function addIconToHistory(type: string, name: string, icon: string): void {
  try {
    logger.info("添加图标到历史记录:", { type, name, icon: `${icon.substring(0, 50)}...` })

    const recentIcons = getRecentIcons()
    const now = Date.now()

    // 检查是否已存在相同图标
    const existingIndex = recentIcons.findIndex(item => item.type === type && item.name === name)

    if (existingIndex !== -1) {
      // 更新现有图标的使用时间
      recentIcons[existingIndex].lastUsed = now
      logger.info("更新现有图标使用时间")
    } else {
      // 添加新图标
      recentIcons.unshift({
        type,
        name,
        icon,
        lastUsed: now,
      })
      logger.info("添加新图标到历史")
    }

    // 限制数量
    const limitedIcons = recentIcons.slice(0, MAX_RECENT_ICONS)

    // 保存到本地存储
    localStorage.setItem(ICON_HISTORY_KEY, JSON.stringify(limitedIcons))
    logger.info("图标历史已保存，当前数量:", limitedIcons.length)
  } catch (error) {
    logger.error("保存图标历史失败:", error)
  }
}

/**
 * 清空图标历史
 */
export function clearIconHistory(): void {
  try {
    localStorage.removeItem(ICON_HISTORY_KEY)
  } catch (error) {
    logger.error("清空图标历史失败:", error)
  }
}

/**
 * 测试函数：添加一些示例图标到历史记录
 */
export function addTestIcons(): void {
  logger.info("添加测试图标到历史记录")

  // 添加一些测试图标
  addIconToHistory("priority", "1", '<svg><circle cx="12" cy="12" r="10" fill="red"/></svg>')
  addIconToHistory("progress", "25", '<svg><rect width="20" height="20" fill="blue"/></svg>')
  addIconToHistory(
    "expression",
    "smile",
    '<svg><circle cx="12" cy="12" r="10" fill="yellow"/></svg>'
  )
  addIconToHistory(
    "sign",
    "star",
    '<svg><polygon points="12,2 15,9 22,9 17,14 19,21 12,17 5,21 7,14 2,9 9,9" fill="gold"/></svg>'
  )

  logger.info("测试图标添加完成，当前历史:", getRecentIcons())
}

// 在开发环境下，将函数暴露到全局，方便测试
if (typeof window !== "undefined") {
  // 定义全局 window 接口的扩展类型
  interface Window {
    addTestIcons?: typeof addTestIcons
    getRecentIcons?: typeof getRecentIcons
    clearIconHistory?: typeof clearIconHistory
  }

  // 开发环境调试需要，将函数暴露到全局window对象
  ;(window as Window).addTestIcons = addTestIcons
  ;(window as Window).getRecentIcons = getRecentIcons
  ;(window as Window).clearIconHistory = clearIconHistory
}
