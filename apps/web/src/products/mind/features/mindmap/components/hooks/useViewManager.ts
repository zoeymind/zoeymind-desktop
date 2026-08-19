// @ts-nocheck — cloud/collab type debt; runtime gated by no-op shims
import { logger } from '@zoeymind/logger'
import { useEffect } from 'react'
import { mindmapDB } from '@/products/mind/features/mindmap/utils/storage/mindmapDB'
import { useProjectMindMapStore as useMindMapStore } from '@/products/mind/editor-session'
import { useProjectContext } from '@/products/mind/features/mindmap/contexts/ProjectContext'

export function useViewManager() {
  // 🚀 从 store 获取 mindMap 和 workspaceId，确保状态一致性
  const { workspaceId } = useProjectContext()
  const { mindMap } = useMindMapStore()
  useEffect(() => {
    if (!mindMap) return

    // 监听视图数据变化
    const handleViewDataChange = () => {
      try {
        const viewData = mindMap.view.getTransformData()
        // 使用 IndexedDB 保存视图数据
        mindmapDB.saveViewData(viewData, workspaceId).catch(error => {
          logger.error('保存视图数据失败:', error)
        })
      } catch (error) {
        logger.error('保存视图数据失败:', error)
      }
    }

    mindMap.on('view_data_change', handleViewDataChange)

    return () => {
      mindMap.off('view_data_change', handleViewDataChange)
    }
  }, [mindMap, workspaceId])
}