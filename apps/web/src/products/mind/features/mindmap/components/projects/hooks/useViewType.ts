import { useState, useCallback } from 'react'

// 视图类型
export type ViewType = 'grid' | 'list'

// 本地存储键
const VIEW_TYPE_STORAGE_KEY = 'project_view_type'

/**
 * 视图类型管理hook
 * 处理项目列表的视图类型（网格/列表）切换和本地存储
 *
 * @returns 视图类型相关状态和方法
 */
export function useViewType() {
  // 视图状态，从本地存储中加载
  const [viewType, setViewType] = useState<ViewType>(() => {
    // 从本地存储加载视图类型，默认为网格视图
    return (localStorage.getItem(VIEW_TYPE_STORAGE_KEY) as ViewType) || 'grid'
  })

  /**
   * 切换视图类型
   */
  const toggleViewType = useCallback(() => {
    const newViewType = viewType === 'grid' ? 'list' : 'grid'
    // 更新状态
    setViewType(newViewType)
    // 保存到本地存储
    localStorage.setItem(VIEW_TYPE_STORAGE_KEY, newViewType)
  }, [viewType])

  return {
    viewType,
    toggleViewType
  }
}

export default useViewType
