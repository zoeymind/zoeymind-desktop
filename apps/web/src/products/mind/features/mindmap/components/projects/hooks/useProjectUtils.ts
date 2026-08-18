// @ts-nocheck — legacy project card util, dormant
import { logger } from '@zoeymind/logger'
import { useCallback } from 'react'
import { i18next } from '@zoeymind/i18n'
import type { ProjectWithStats } from '@/shared/mindmap-bridge'

// 项目默认颜色列表
export const PROJECT_COLORS = [
  'hsl(var(--brand-blue))', // 蓝色
  'hsl(var(--brand-green))', // 绿色
  'hsl(var(--brand-orange))', // 橙色
  'hsl(var(--brand-purple))', // 紫色
  'hsl(var(--brand-pink))', // 粉色
  'hsl(var(--brand-cyan))' // 青色
]

/**
 * 项目工具函数hook
 * 提供项目相关的工具函数
 */
export function useProjectUtils() {
  /**
   * 格式化相对时间
   * @param date 日期
   * @returns 格式化后的相对时间文本
   */
  const getRelativeTime = useCallback((date: Date): string => {
    const now = new Date()
    const diff = now.getTime() - new Date(date).getTime()

    const seconds = Math.floor(diff / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)
    const days = Math.floor(hours / 24)

    if (days > 0) {
      return i18next.t('projects.actions.daysAgo', { value: days })
    } else if (hours > 0) {
      return i18next.t('projects.actions.hoursAgo', { value: hours })
    } else if (minutes > 0) {
      return i18next.t('projects.actions.minutesAgo', { value: minutes })
    } else {
      return i18next.t('common.time.justNow')
    }
  }, [])

  /**
   * 估算预览图大小
   * @param preview 预览图base64字符串
   * @returns 预览图大小（字节）
   */
  const getPreviewImageSize = useCallback((preview?: string): number => {
    if (!preview) return 0

    try {
      // base64字符串的大小估算: 字符数 * 0.75
      // 减去data:image部分
      const base64Data = preview.split(',')[1] || preview
      return Math.ceil(base64Data.length * 0.75)
    } catch (error) {
      logger.error('估算预览图大小失败:', error)
      return 0
    }
  }, [])

  /**
   * 计算项目大小
   * @param project 项目数据
   * @returns 格式化后的项目大小文本
   */
  const getProjectSize = useCallback(
    (project: ProjectWithStats): string => {
      // 从项目元数据中获取文件大小
      if (project.metadata?.fileSize) {
        const fileSizeBytes = project.metadata.fileSize as number
        const previewSize = getPreviewImageSize(project.metadata?.preview as string)

        // 文件大小加上预览图大小
        const totalBytes = fileSizeBytes + previewSize

        // 转换为可读格式
        if (totalBytes < 1024) {
          return `${totalBytes}B`
        } else if (totalBytes < 1024 * 1024) {
          return `${(totalBytes / 1024).toFixed(1)}KB`
        } else {
          return `${(totalBytes / (1024 * 1024)).toFixed(1)}MB`
        }
      }

      // 如果没有保存文件大小，使用节点数量和消息数量进行估算
      const nodeCount = (project.metadata?.nodeCount as number) || 0
      const conversationSize = project.stats.conversationCount || 0
      const messageSize = project.stats.messageCount || 0
      const previewSize = getPreviewImageSize(project.metadata?.preview as string)

      // 估算: 每个节点约200字节，每个会话500字节，每条消息1KB，加上预览图大小
      const totalSize = nodeCount * 200 + conversationSize * 500 + messageSize * 1024 + previewSize

      if (totalSize < 1024) {
        return `${totalSize.toFixed(0)}B`
      } else if (totalSize < 1024 * 1024) {
        return `${(totalSize / 1024).toFixed(1)}KB`
      } else {
        return `${(totalSize / (1024 * 1024)).toFixed(1)}MB`
      }
    },
    [getPreviewImageSize]
  )

  /**
   * 基于项目ID生成一致的颜色
   * @param workspaceId 项目ID
   * @returns 颜色代码
   */
  const getProjectColor = useCallback((workspaceId: string): string => {
    const hashCode = workspaceId.split('').reduce((acc, char) => {
      return char.charCodeAt(0) + ((acc << 5) - acc)
    }, 0)
    const index = Math.abs(hashCode) % PROJECT_COLORS.length
    return PROJECT_COLORS[index]
  }, [])

  return {
    getRelativeTime,
    getProjectSize,
    getPreviewImageSize,
    getProjectColor
  }
}

export default useProjectUtils