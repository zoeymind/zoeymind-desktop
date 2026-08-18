import { logger } from '@zoeymind/logger'
import { useCallback, useEffect, useRef } from 'react'
import type { default as MindMap } from 'simple-mind-map'
import { trpcClient } from '@/shared/app-shared'
import { defaultData } from './useCanvasManager'
import {
  getMindMapPreview,
  getNodeCount
} from '@/products/mind/features/mindmap/utils/mindMapExporter'
import { toast } from '@/shared/app-shared'
import { useProjectContext } from '@/products/mind/features/mindmap/contexts/ProjectContext'
import { usePermissionStore } from '@/products/mind/features/mindmap/stores/permission-store'

// 使用tRPC内置的客户端错误类型
import { TRPCClientError } from '@trpc/client'
import { i18next } from '@zoeymind/i18n'

/**
 * 云端存储管理钩子
 * 负责云端思维导图数据的加载和保存
 */
export function useCloudStorageManager(
  mindMap: MindMap | null,
  options?: { collaborative?: boolean }
) {
  // 🎯 从 Context 获取 workspaceId (页面级作用域)
  const canEdit = usePermissionStore(state => state.canEdit)
  const { workspaceId } = useProjectContext()
  const isInitializedRef = useRef(false)
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastPreviewUploadRef = useRef(0)
  const previewUploadingRef = useRef(false)
  const PREVIEW_INTERVAL = 30_000

  const compressPreview = useCallback(async (base64: string) => {
    if (!base64 || typeof window === 'undefined') return base64
    try {
      const compressed = await new Promise<string>((resolve, reject) => {
        const img = new Image()
        img.onload = () => {
          const targetWidth = 640
          const scale = Math.min(1, targetWidth / img.width)
          const width = Math.max(1, Math.round(img.width * scale))
          const height = Math.max(1, Math.round(img.height * scale))
          const canvas = document.createElement('canvas')
          canvas.width = width
          canvas.height = height
          const ctx = canvas.getContext('2d')
          if (!ctx) {
            reject(new Error('无法获取画布上下文'))
            return
          }
          ctx.drawImage(img, 0, 0, width, height)
          resolve(canvas.toDataURL('image/jpeg', 0.75))
        }
        img.onerror = () => reject(new Error('预览图压缩失败'))
        img.src = base64
      })
      return compressed
    } catch (error) {
      logger.warn('压缩预览图失败，使用原图', error)
      return base64
    }
  }, [])

  const loadSavedData = useCallback(async () => {
    if (!workspaceId) {
      logger.info('云端存储管理器: 没有项目ID，返回默认数据')
      return {
        savedData: defaultData,
        savedViewData: null
      }
    }

    try {
      logger.info('云端存储管理器: 开始加载数据', {
        workspaceId,
        collaborative: options?.collaborative === true
      })

      const response = await trpcClient.mindmap.content.getYDocData.query({
        mindmapId: workspaceId
      })

      if (response.success && response.content) {
        logger.info('云端存储管理器: 数据加载成功')
        return {
          savedData: response.content,
          savedViewData: null
        }
      }

      if (response.success && response.content === null && options?.collaborative) {
        // 协作模式下content为null表示数据在YDoc中，使用默认数据
        logger.info('云端存储管理器: 协作模式下数据在YDoc中，使用默认数据')
        return {
          savedData: defaultData,
          savedViewData: null
        }
      }

      logger.info('云端存储管理器: 项目内容为空，使用默认数据', {
        collaborative: options?.collaborative
      })
      return {
        savedData: defaultData,
        savedViewData: null
      }
    } catch (error: unknown) {
      logger.error('云端存储管理器: 加载数据失败', error)

      if (error instanceof TRPCClientError) {
        if (error.message?.includes('NOT_FOUND') || error.data?.code === 'NOT_FOUND') {
          logger.info('云端存储管理器: 项目不存在，使用默认数据')
          // 错误
          throw error
        }
      }

      throw error
    }
  }, [workspaceId, options?.collaborative])

  const saveData = useCallback(async () => {
    if (!mindMap || !workspaceId) {
      logger.warn('云端存储管理器: 无法保存, 缺少思维导图实例或项目ID')
      return
    }

    // 只读用户没有 write 权限, 所有 mindmap.update 会 403; 直接跳过.
    if (!canEdit) {
      logger.debug('云端存储管理器: 只读用户, 跳过 saveData (无 write 权限)')
      return
    }

    if (options?.collaborative) {
      logger.info('云端存储管理器: 协同模式依赖 YJS 自动持久化, 跳过手动保存', {
        workspaceId
      })
      return
    }

    try {
      const data = mindMap.getData()
      const content = JSON.stringify(data)
      const nodeCount = getNodeCount(mindMap)
      const theme = typeof mindMap.getTheme === 'function' ? mindMap.getTheme() : undefined

      logger.info('云端存储管理器: 开始保存数据', {
        workspaceId,
        contentLength: content.length,
        nodeCount
      })

      // 内容通过 WebSocket + YJS 实时同步，不需要显式保存
      // YJS 会自动持久化到服务器

      try {
        if (!mindMap.renderer?.isRendering && !mindMap.renderer?.textEdit?.showTextEdit) {
          const previewData = await getMindMapPreview(mindMap)
          const uploadResult = await trpcClient.upload.uploadMindmapCover.mutate({
            category: 'mindmap',
            type: 'cover',
            imageData: previewData,
            imageFormat: 'png',
            relatedId: workspaceId
          })

          if (uploadResult.success) {
            // 封面图已直接保存到数据库，无需额外更新 coverKey
            await trpcClient.mindmap.update.mutate({
              mindmapId: workspaceId,
              theme
            })
          }

          await trpcClient.mindmap.update.mutate({
            mindmapId: workspaceId,
            nodeCount,
            theme
          })

          logger.info('云端存储管理器: 预览图上传和元数据更新成功', { workspaceId, nodeCount })
        } else {
          await trpcClient.mindmap.update.mutate({
            mindmapId: workspaceId,
            nodeCount,
            theme
          })

          logger.info('云端存储管理器: 元数据更新成功（跳过预览图）', { workspaceId, nodeCount })
        }
      } catch (previewError) {
        logger.warn('云端存储管理器: 预览图处理失败，但内容已保存', previewError)

        try {
          await trpcClient.mindmap.update.mutate({
            mindmapId: workspaceId,
            nodeCount,
            theme
          })
        } catch (metaError) {
          logger.warn('云端存储管理器: 元数据更新也失败', metaError)
        }
      }

      logger.info('云端存储管理器: 数据保存成功')

      toast({
        title: i18next.t('mindmap.toast.saveSuccessTitle'),
        description: i18next.t('mindmap.toast.saveSuccessDesc', { count: nodeCount }),
        variant: 'success'
      })
    } catch (error: unknown) {
      logger.error('云端存储管理器: 保存数据失败', error)

      toast({
        title: i18next.t('mindmap.toast.saveFailedTitle'),
        description:
          error instanceof TRPCClientError
            ? error.message
            : i18next.t('mindmap.toast.saveFailedDesc'),
        variant: 'destructive'
      })

      throw error
    }
  }, [mindMap, workspaceId, options?.collaborative, canEdit])

  const uploadPreviewThrottled = useCallback(async () => {
    if (!mindMap || !workspaceId || !options?.collaborative) {
      return false
    }
    if (!canEdit) return false

    if (previewUploadingRef.current) {
      return false
    }

    const now = Date.now()
    if (now - lastPreviewUploadRef.current < PREVIEW_INTERVAL) {
      return false
    }

    if (mindMap.renderer?.isRendering || mindMap.renderer?.textEdit?.showTextEdit) {
      logger.debug('预览图上传跳过：渲染中或正在编辑')
      return false
    }

    previewUploadingRef.current = true
    try {
      const previewDataRaw = await getMindMapPreview(mindMap)
      const previewData = await compressPreview(previewDataRaw)
      const nodeCount = getNodeCount(mindMap)

      const uploadResult = await trpcClient.upload.uploadMindmapCover.mutate({
        category: 'mindmap',
        type: 'cover',
        imageData: previewData,
        imageFormat: 'jpeg',
        relatedId: workspaceId
      })

      if (uploadResult.success) {
        // 封面图已直接保存到数据库，只需更新节点数
        await trpcClient.mindmap.update.mutate({
          mindmapId: workspaceId,
          nodeCount
        })
        lastPreviewUploadRef.current = Date.now()
        return true
      }
      return false
    } catch (error) {
      logger.warn('协同预览图上传失败', error)
      return false
    } finally {
      previewUploadingRef.current = false
    }
  }, [mindMap, workspaceId, options?.collaborative, canEdit, compressPreview])

  const debouncedSave = useCallback(
    (delay: number = 1000) => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }

      saveTimeoutRef.current = setTimeout(() => {
        saveData().finally(() => {
          saveTimeoutRef.current = null
        })
      }, delay)
    },
    [saveData]
  )

  useEffect(() => {
    if (mindMap && !isInitializedRef.current) {
      logger.info('云端存储管理器: MindMap 实例已准备好，初始化完成')
      isInitializedRef.current = true
    }

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
        saveTimeoutRef.current = null
      }
    }
  }, [mindMap])

  return {
    loadSavedData,
    saveData,
    debouncedSave,
    uploadPreviewThrottled
  }
}
