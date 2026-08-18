import { logger } from '@zoeymind/logger'
import { useState, useCallback } from 'react'
import { projectDB } from '@/shared/mindmap-bridge'
import type { ProjectWithStats } from '@/shared/mindmap-bridge'

interface UseProjectStarProps {
  project: ProjectWithStats
  onUpdate?: () => void
}

/**
 * 项目星标状态管理hook
 * 处理项目的收藏/取消收藏逻辑
 *
 * @param project 项目数据
 * @param onUpdate 状态更新回调
 * @returns 收藏相关状态和方法
 */
export function useProjectStar({ project, onUpdate }: UseProjectStarProps) {
  const [isStarred, setIsStarred] = useState<boolean>(!!project.metadata?.starred)

  /**
   * 切换项目收藏状态
   * @param e 可选的事件对象
   */
  const toggleStar = useCallback(
    async (e?: React.MouseEvent) => {
      if (e) {
        e.stopPropagation()
      }

      const newStarredState = !isStarred
      setIsStarred(newStarredState)

      // 更新项目元数据，使用不改变时间戳的方法
      try {
        await projectDB.updateProjectMetadata(project.id, {
          starred: newStarredState
        })

        // 通知父组件更新列表（用于重新排序）
        if (onUpdate) {
          onUpdate()
        }
      } catch (error) {
        logger.error('更新收藏状态失败:', error)
        // 恢复状态
        setIsStarred(!newStarredState)
      }
    },
    [isStarred, project, onUpdate]
  )

  return {
    isStarred,
    toggleStar
  }
}

export default useProjectStar
