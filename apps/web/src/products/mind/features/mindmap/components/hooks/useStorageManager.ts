import { logger } from '@zoeymind/logger'
import { useCallback, useEffect, useRef } from 'react'
import { generateAndSavePreview } from '@/products/mind/features/mindmap/utils/mindMapExporter'
import { defaultData } from './useCanvasManager'
import { mindmapDB } from '@/products/mind/features/mindmap/utils/storage/mindmapDB'
import { projectDB } from '@/shared/mindmap-bridge'
import { useMindMapStore } from '@/products/mind/features/mindmap/stores/mindmap-store'
import { useProjectContext } from '@/products/mind/features/mindmap/contexts/ProjectContext'

// 自动保存间隔（毫秒）
const AUTO_SAVE_INTERVAL = 5000
// 自动快照检查间隔（毫秒） - 每10分钟检查一次
const AUTO_SNAPSHOT_CHECK_INTERVAL = 10 * 60 * 1000

/**
 * 存储管理钩子
 * 负责思维导图数据的加载和保存
 */
export function useStorageManager() {
  // 🎯 从 Context 获取 workspaceId 和 cloudMode (页面级作用域)
  const { workspaceId, cloudMode } = useProjectContext()
  // 从 store 获取 mindMap 实例
  const { mindMap } = useMindMapStore()
  // 用于跟踪实例是否已完全初始化
  const isInitializedRef = useRef(false)
  // 用于跟踪是否正在拖动
  const isDraggingRef = useRef(false)
  // 用于存储自动保存定时器
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null)
  // 用于存储自动快照定时器
  const autoSnapshotTimerRef = useRef<NodeJS.Timeout | null>(null)

  // 加载已保存的数据
  const loadSavedData = useCallback(async () => {
    // 使用 workspaceId (来自 Context,在依赖数组中)
    const currentProjectId = workspaceId

    try {
      // 如果提供了项目ID，先验证项目是否存在
      if (currentProjectId) {
        const project = await projectDB.getProject(currentProjectId)
        if (!project) {
          logger.warn(`项目 ${currentProjectId} 不存在，使用默认数据`)
          return {
            savedData: defaultData,
            savedViewData: null
          }
        }
      }

      // 从 IndexedDB 加载数据
      const savedData = await mindmapDB.load(currentProjectId)
      const savedViewData = await mindmapDB.loadViewData(currentProjectId)

      logger.info(`✅ 加载本地数据成功 - workspaceId: ${currentProjectId || '默认'}`)

      // 返回加载的数据
      return {
        savedData,
        savedViewData
      }
    } catch (error) {
      logger.error('加载思维导图数据失败:', error)

      // 无数据或出错时返回默认数据
      return {
        savedData: defaultData,
        savedViewData: null
      }
    }
  }, [])

  // 检查实例是否已完全初始化
  const checkInitialized = useCallback(() => {
    if (!mindMap) return false

    try {
      // 检查基本实例是否存在
      if (!mindMap.renderer || !mindMap.view) return false

      // 检查是否正在渲染中
      if (mindMap.renderer.isRendering) return false

      // 检查根节点是否存在且有数据
      if (!mindMap.renderer.root || !mindMap.renderer.root.nodeData) return false

      // 检查是否处于文本编辑状态
      if (mindMap.renderer.textEdit?.showTextEdit) return false

      return true
    } catch {
      return false
    }
  }, [mindMap])

  // 保存数据（不包含预览图生成）
  const saveData = useCallback(async () => {
    if (!mindMap) return

    // 使用 workspaceId (来自 Context)
    const currentProjectId = workspaceId

    try {
      // 检查实例是否已完全初始化
      if (!checkInitialized()) {
        logger.warn('思维导图实例未完全初始化，跳过保存')
        return
      }

      const mindMapData = mindMap.getData()

      await mindmapDB.save(mindMapData, currentProjectId)

      logger.info(`💾 数据保存成功 - workspaceId: ${currentProjectId || '默认'}`)
    } catch (error) {
      logger.error('保存思维导图数据失败:', error)
    }
  }, [mindMap, checkInitialized])

  // 保存数据并生成预览图
  const saveDataWithPreview = useCallback(async () => {
    // 使用 workspaceId (来自 Context)
    const currentProjectId = workspaceId

    if (!mindMap || !currentProjectId) return

    try {
      // 先保存基本数据
      await saveData()

      // 如果正在编辑，延迟生成预览图
      if (mindMap.renderer?.textEdit?.showTextEdit) {
        logger.info('正在编辑中，延迟生成预览图')
        setTimeout(() => {
          generateAndSavePreview(mindMap, currentProjectId).catch(error => {
            logger.error('延迟生成预览图失败:', error)
          })
        }, 1000) // 延迟1秒后生成预览图
      } else {
        // 立即生成并保存预览图
        generateAndSavePreview(mindMap, currentProjectId).catch(error => {
          logger.error('生成预览图失败:', error)
        })
      }
    } catch (error) {
      logger.error('保存思维导图数据失败:', error)
    }
  }, [mindMap, saveData])

  // 创建自动快照
  const createAutoSnapshot = useCallback(async () => {
    // 使用 workspaceId (来自 Context)
    const currentProjectId = workspaceId

    if (!mindMap || !currentProjectId) return

    try {
      // 检查是否需要创建自动快照
      const shouldCreate = await projectDB.snapshots.shouldCreateAutoSnapshot(currentProjectId)
      if (!shouldCreate) {
        return
      }

      // 获取当前数据
      const mindMapData = mindMap.getData()
      const viewData = mindMap.view.getTransformData()

      // 创建自动快照
      const snapshotName = `自动快照 ${new Date().toLocaleString('zh-CN')}`
      await projectDB.snapshots.create(
        currentProjectId,
        snapshotName,
        mindMapData,
        viewData,
        true, // isAuto = true
        '系统自动创建的快照'
      )

      logger.info('自动快照创建成功')
    } catch (error) {
      logger.error('创建自动快照失败:', error)
    }
  }, [mindMap])

  // 设置自动保存定时器
  const setupAutoSave = useCallback(() => {
    // 清除已存在的定时器
    if (autoSaveTimerRef.current) {
      clearInterval(autoSaveTimerRef.current)
    }

    // 设置新的定时器，每5秒保存一次
    autoSaveTimerRef.current = setInterval(() => {
      if (mindMap && !isDraggingRef.current) {
        saveDataWithPreview().catch(error => {
          logger.error('自动保存失败:', error)
        })
      }
    }, AUTO_SAVE_INTERVAL)
  }, [mindMap, saveDataWithPreview])

  // 设置自动快照定时器
  const setupAutoSnapshot = useCallback(() => {
    // 清除已存在的定时器
    if (autoSnapshotTimerRef.current) {
      clearInterval(autoSnapshotTimerRef.current)
    }

    // 使用 workspaceId (来自 Context)
    const currentProjectId = workspaceId

    // 只有在有projectId时才设置自动快照
    if (!currentProjectId) return

    // 设置新的定时器，每10分钟检查一次
    autoSnapshotTimerRef.current = setInterval(() => {
      if (mindMap && !isDraggingRef.current) {
        createAutoSnapshot().catch(error => {
          logger.error('自动快照失败:', error)
        })
      }
    }, AUTO_SNAPSHOT_CHECK_INTERVAL)

    // 初始检查一次
    setTimeout(() => {
      if (mindMap && !isDraggingRef.current) {
        createAutoSnapshot().catch(error => {
          logger.error('初始自动快照检查失败:', error)
        })
      }
    }, 30000) // 30秒后进行第一次检查
  }, [mindMap, createAutoSnapshot])

  // 监听数据变化
  useEffect(() => {
    if (!mindMap) return

    // ✅ 云模式下不启动本地自动保存和自动快照
    if (cloudMode) {
      return
    }

    // 监听拖动开始和结束
    const handleDragStart = () => {
      isDraggingRef.current = true
    }

    const handleDragEnd = () => {
      isDraggingRef.current = false
    }

    // 监听拖动相关事件
    if (mindMap.el) {
      mindMap.el.addEventListener('mousedown', handleDragStart)
      mindMap.el.addEventListener('mouseup', handleDragEnd)
    }

    // 在组件挂载时检查一次初始化状态
    isInitializedRef.current = checkInitialized()

    // 设置自动保存
    setupAutoSave()

    // 设置自动快照
    setupAutoSnapshot()

    // 清理事件监听和定时器
    return () => {
      if (mindMap.el) {
        mindMap.el.removeEventListener('mousedown', handleDragStart)
        mindMap.el.removeEventListener('mouseup', handleDragEnd)
      }
      if (autoSaveTimerRef.current) {
        clearInterval(autoSaveTimerRef.current)
      }
      if (autoSnapshotTimerRef.current) {
        clearInterval(autoSnapshotTimerRef.current)
      }
    }
  }, [mindMap, cloudMode, checkInitialized, setupAutoSave, setupAutoSnapshot])

  return {
    loadSavedData,
    saveData: saveDataWithPreview, // 对外暴露的保存函数包含预览图生成
    createAutoSnapshot // 暴露手动创建快照的方法
  }
}
