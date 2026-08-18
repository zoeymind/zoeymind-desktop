import { useState, useCallback } from 'react'
import { trpcClient } from '@/shared/app-shared'
import { useToast } from '@/shared/app-shared'
import { logger } from '@zoeymind/logger'
import { i18next } from '@zoeymind/i18n'
import { snapshotDataToJson } from '@/products/mind/features/mindmap/utils/yjs-helper'
import type { CreateSnapshotInput, GetSnapshotsInput } from '@zoeymind/shared'

// 简化的快照数据类型，直接使用后端返回的结构
export interface CloudSnapshot {
  id: string
  mindmapId: string
  name: string
  description?: string | null
  version: number
  isAuto: boolean
  nodeCount: number
  createdBy: string
  createdAt: string // 后端返回的是字符串
  creator?: {
    id: string
    name: string | null
    avatar: string | null
  } | null
}

export interface CloudSnapshotDetail extends CloudSnapshot {
  data?: unknown
  viewData?: unknown
}

export interface UseCloudSnapshotOptions {
  mindmapId: string
  onSnapshotCreated?: (snapshot: CloudSnapshot) => void
  onSnapshotDeleted?: (snapshotId: string) => void
  onSnapshotRestored?: () => void
}

export interface CloudSnapshotState {
  snapshots: CloudSnapshot[]
  loading: boolean
  creating: boolean
  deleting: boolean
  total: number
  page: number
  limit: number
}

/**
 * 云端快照管理 Hook
 * 提供快照的创建、查询、删除和恢复功能
 */
export function useCloudSnapshot({
  mindmapId,
  onSnapshotCreated,
  onSnapshotDeleted
}: UseCloudSnapshotOptions) {
  const { toast } = useToast()

  const [state, setState] = useState<CloudSnapshotState>({
    snapshots: [],
    loading: false,
    creating: false,
    deleting: false,
    total: 0,
    page: 1,
    limit: 20
  })

  /**
   * 加载快照列表
   */
  const loadSnapshots = useCallback(
    async (options: Partial<GetSnapshotsInput> = {}) => {
      if (!mindmapId) return

      setState(prev => ({ ...prev, loading: true }))

      try {
        const input: GetSnapshotsInput = {
          mindmapId,
          includeAuto: true,
          page: 1,
          limit: 20,
          ...options
        }

        const response = await trpcClient.mindmap.snapshot.list.query(input)

        if (response.success) {
          setState(prev => ({
            ...prev,
            snapshots: response.snapshots,
            total: response.total,
            page: response.page,
            limit: response.limit,
            loading: false
          }))
        }
      } catch (error) {
        logger.error('加载快照列表失败:', error)
        toast({
          title: i18next.t('mindmap.toast.snapshotLoadFailedTitle'),
          description: i18next.t('mindmap.toast.snapshotLoadFailedDesc'),
          variant: 'destructive'
        })
        setState(prev => ({ ...prev, loading: false }))
      }
    },
    [mindmapId, toast]
  )

  /**
   * 创建快照
   */
  const createSnapshot = useCallback(
    async (
      name: string,
      description?: string,
      isAuto: boolean = false
    ): Promise<CloudSnapshot | null> => {
      if (!mindmapId || !name.trim()) return null

      setState(prev => ({ ...prev, creating: true }))

      try {
        const input: CreateSnapshotInput = {
          mindmapId,
          name: name.trim(),
          description: description?.trim(),
          isAuto
        }

        const response = await trpcClient.mindmap.snapshot.create.mutate(input)

        if (response.success && response.snapshot) {
          setState(prev => ({ ...prev, creating: false }))

          toast({
            description: i18next.t('mindmap.toast.snapshotCreatedDesc', { name })
          })

          onSnapshotCreated?.(response.snapshot)

          // 重新加载快照列表
          await loadSnapshots()

          return response.snapshot
        }

        return null
      } catch (error) {
        logger.error('创建快照失败:', error)
        toast({
          title: i18next.t('mindmap.toast.snapshotCreateFailedTitle'),
          description: i18next.t('mindmap.toast.snapshotCreateFailedDesc'),
          variant: 'destructive'
        })
        setState(prev => ({ ...prev, creating: false }))
        return null
      }
    },
    [mindmapId, toast, onSnapshotCreated, loadSnapshots]
  )

  /**
   * 获取快照详情（自动转换二进制数据为 JSON）
   *
   * 后端返回的 Buffer 经 tRPC JSON 序列化后变为 { type:"Buffer", data:[...] }，
   * 需要先还原为 Uint8Array 再解码为思维导图 JSON 树。
   */
  const getSnapshotDetail = useCallback(
    async (snapshotId: string): Promise<CloudSnapshotDetail | null> => {
      try {
        const response = await trpcClient.mindmap.snapshot.get.query({ snapshotId })

        if (response.success && response.snapshot) {
          const snapshot = response.snapshot

          if (snapshot.data) {
            logger.debug('Converting snapshot data to JSON', {
              snapshotId,
              dataType: typeof snapshot.data
            })

            const jsonData = snapshotDataToJson(snapshot.data)

            if (!jsonData) {
              logger.error('Failed to convert snapshot data to JSON')
              toast({
                title: i18next.t('mindmap.toast.snapshotConvertFailedTitle'),
                description: i18next.t('mindmap.toast.snapshotConvertFailedDesc'),
                variant: 'destructive'
              })
              return null
            }

            return {
              ...snapshot,
              data: jsonData,
              viewData: snapshot.viewData ? snapshotDataToJson(snapshot.viewData) : undefined
            }
          }

          return snapshot
        }

        return null
      } catch (error) {
        logger.error('获取快照详情失败:', error)
        toast({
          title: i18next.t('mindmap.toast.snapshotGetFailedTitle'),
          description: i18next.t('mindmap.toast.snapshotGetFailedDesc'),
          variant: 'destructive'
        })
        return null
      }
    },
    [toast]
  )

  /**
   * 删除快照
   */
  const deleteSnapshot = useCallback(
    async (snapshotId: string, snapshotName: string): Promise<boolean> => {
      setState(prev => ({ ...prev, deleting: true }))

      try {
        const response = await trpcClient.mindmap.snapshot.delete.mutate({ snapshotId })

        if (response.success) {
          setState(prev => ({ ...prev, deleting: false }))

          toast({
            description: i18next.t('mindmap.toast.snapshotDeletedDesc', { name: snapshotName })
          })

          onSnapshotDeleted?.(snapshotId)

          // 重新加载快照列表
          await loadSnapshots()

          return true
        }

        return false
      } catch (error) {
        logger.error('删除快照失败:', error)
        toast({
          title: i18next.t('mindmap.toast.snapshotDeleteFailedTitle'),
          description: i18next.t('mindmap.toast.snapshotDeleteFailedDesc'),
          variant: 'destructive'
        })
        setState(prev => ({ ...prev, deleting: false }))
        return false
      }
    },
    [toast, onSnapshotDeleted, loadSnapshots]
  )

  return {
    ...state,
    loadSnapshots,
    createSnapshot,
    getSnapshotDetail,
    deleteSnapshot
  }
}
