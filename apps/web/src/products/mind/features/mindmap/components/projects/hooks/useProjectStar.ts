/**
 * useProjectStar —— 桌面端本地版：直接调 SqlProjectRepo.setStarred。
 */
import { logger } from '@zoeymind/logger'
import { useState, useCallback } from 'react'
import { setStarred, type ProjectRow } from '@/shared/native'

interface UseProjectStarProps {
  project: ProjectRow
  onUpdate?: () => void
}

export function useProjectStar({ project, onUpdate }: UseProjectStarProps) {
  const [isStarred, setIsStarredState] = useState<boolean>(project.isStarred)

  const toggleStar = useCallback(
    async (e?: React.MouseEvent) => {
      if (e) e.stopPropagation()
      const next = !isStarred
      setIsStarredState(next)
      try {
        await setStarred(project.id, next)
        onUpdate?.()
      } catch (error) {
        logger.error('更新收藏状态失败:', error)
        setIsStarredState(!next)
      }
    },
    [isStarred, project.id, onUpdate]
  )

  return { isStarred, toggleStar }
}

export default useProjectStar
