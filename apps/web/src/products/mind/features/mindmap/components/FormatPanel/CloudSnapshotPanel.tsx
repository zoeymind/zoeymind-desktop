import React, { useState, useEffect, useCallback } from 'react'
import { useTranslation } from '@zoeymind/i18n'
import { motion } from 'motion/react'
import {
  Button,
  Spinner,
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription
} from '@zoeymind/ui'
import { Input } from '@zoeymind/ui'
import { Textarea } from '@zoeymind/ui'
import { useToast } from '@/shared/app-shared'
import { logger } from '@zoeymind/logger'
import { Clock, Camera, X, RotateCcw, Eye, Plus, Calendar, Cloud, Archive } from 'lucide-react'
import {
  useCloudSnapshot,
  type CloudSnapshot,
  type CloudSnapshotDetail
} from '@/products/mind/features/mindmap/components/hooks/useCloudSnapshot'
import { useMindMapStore } from '@/products/mind/features/mindmap/stores/mindmap-store'
import { useProjectContext } from '@/products/mind/features/mindmap/contexts/ProjectContext'
import { SnapshotPreviewModal } from '@/products/mind/features/mindmap/components/SnapshotPreviewModal'
import {
  convertSnapshotToTreeData,
  type SnapshotDataInput
} from '@/products/mind/features/mindmap/utils/snapshotData'

interface CloudSnapshotPanelProps {
  isActive: boolean
}

export const CloudSnapshotPanel: React.FC<CloudSnapshotPanelProps> = ({ isActive }) => {
  const { t } = useTranslation()
  // 从store获取mindMap实例和projectId
  const { workspaceId } = useProjectContext()
  const { mindMap } = useMindMapStore()
  const { toast } = useToast()

  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [restoreModalOpen, setRestoreModalOpen] = useState(false)
  const [previewModalOpen, setPreviewModalOpen] = useState(false)
  const [selectedSnapshot, setSelectedSnapshot] = useState<CloudSnapshot | null>(null)
  const [previewSnapshot, setPreviewSnapshot] = useState<CloudSnapshotDetail | null>(null)
  const [newSnapshotName, setNewSnapshotName] = useState('')
  const [newSnapshotDescription, setNewSnapshotDescription] = useState('')
  const [restoring, setRestoring] = useState(false)

  const {
    snapshots,
    loading,
    creating,
    deleting,
    loadSnapshots,
    createSnapshot,
    getSnapshotDetail,
    deleteSnapshot
  } = useCloudSnapshot({
    mindmapId: workspaceId || '',
    onSnapshotCreated: () => {
      // 快照创建后的回调
    },
    onSnapshotDeleted: () => {
      // 快照删除后的回调
    },
    onSnapshotRestored: () => {
      // 快照恢复在 handleRestoreConfirm 和 handleRestoreFromPreview 中处理
    }
  })

  // 加载快照列表
  useEffect(() => {
    if (isActive && workspaceId) {
      loadSnapshots()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, workspaceId])

  // 关闭预览 Modal
  const handleClosePreview = useCallback(() => {
    setPreviewModalOpen(false)
    setPreviewSnapshot(null)
  }, [])

  // 创建手动快照
  const handleCreateSnapshot = useCallback(async () => {
    if (!newSnapshotName.trim()) return

    const snapshot = await createSnapshot(
      newSnapshotName.trim(),
      newSnapshotDescription.trim() || undefined,
      false
    )

    if (snapshot) {
      // 重置表单
      setNewSnapshotName('')
      setNewSnapshotDescription('')
      setCreateModalOpen(false)
    }
  }, [newSnapshotName, newSnapshotDescription, createSnapshot])

  // 预览快照 - 使用独立的 Modal 组件
  const handlePreview = useCallback(
    async (snapshot: CloudSnapshot) => {
      try {
        // 立即打开 Modal (显示 loading 状态)
        setPreviewModalOpen(true)
        setPreviewSnapshot(null) // 先清空,触发 loading

        // 获取快照详情
        const snapshotDetail = await getSnapshotDetail(snapshot.id)
        if (!snapshotDetail) {
          setPreviewModalOpen(false) // 关闭 Modal
          toast({
            title: t('mindmap.formatPanel.snapshot.toastPreviewFailedTitle'),
            description: t('mindmap.formatPanel.snapshot.toastPreviewFailedDetailDesc'),
            variant: 'destructive'
          })
          return
        }

        // 设置预览数据
        setPreviewSnapshot(snapshotDetail)
      } catch (error) {
        logger.error('预览快照失败:', error)
        setPreviewModalOpen(false) // 关闭 Modal
        toast({
          title: t('mindmap.formatPanel.snapshot.toastPreviewFailedTitle'),
          description: t('mindmap.formatPanel.snapshot.toastPreviewFailedDesc'),
          variant: 'destructive'
        })
      }
    },
    [getSnapshotDetail, toast]
  )

  // 删除快照确认
  const handleDeleteConfirm = useCallback(async () => {
    if (!selectedSnapshot) return

    const success = await deleteSnapshot(selectedSnapshot.id, selectedSnapshot.name)
    if (success) {
      setDeleteModalOpen(false)
      setSelectedSnapshot(null)
    }
  }, [selectedSnapshot, deleteSnapshot])

  // 恢复快照确认
  const handleRestoreConfirm = useCallback(async () => {
    if (!selectedSnapshot || !mindMap) return

    setRestoring(true)
    try {
      // 1. 获取快照数据
      const snapshotDetail = await getSnapshotDetail(selectedSnapshot.id)

      if (!snapshotDetail?.data) {
        throw new Error(t('mindmap.formatPanel.snapshot.errorDataEmpty'))
      }

      // 2. 智能转换：支持新格式（树结构）和旧格式（扁平对象）
      const treeData = convertSnapshotToTreeData(snapshotDetail.data as SnapshotDataInput)
      if (!treeData) {
        throw new Error(t('mindmap.formatPanel.snapshot.errorConvertFailed'))
      }

      // 3. 使用快照数据更新画布(和导入xmind一样的逻辑)
      mindMap.updateData(treeData)

      // 4. 等待渲染完成后收起节点
      if (treeData.data && treeData.data.uid) {
        setTimeout(() => {
          mindMap.execCommand('UNEXPAND_ALL', false, treeData.data.uid)
        }, 0)
      }

      // 5. 关闭对话框
      setRestoreModalOpen(false)
      setSelectedSnapshot(null)
      handleClosePreview()

      toast({
        description: t('mindmap.formatPanel.snapshot.toastRestoreSuccessCloudDesc')
      })
    } catch (error) {
      logger.error('恢复快照失败:', error)
      toast({
        title: t('mindmap.formatPanel.snapshot.toastRestoreFailedTitle'),
        description:
          error instanceof Error
            ? error.message
            : t('mindmap.formatPanel.snapshot.toastRestoreFailedUnknown'),
        variant: 'destructive'
      })
    } finally {
      setRestoring(false)
    }
  }, [selectedSnapshot, mindMap, getSnapshotDetail, handleClosePreview, toast])

  // 从预览 Modal 中恢复快照
  const handleRestoreFromPreview = useCallback(
    async (snapshotId: string) => {
      if (!mindMap) return

      setRestoring(true)
      try {
        const snapshot = snapshots.find(s => s.id === snapshotId)
        if (!snapshot) return

        // 1. 获取快照数据
        const snapshotDetail = await getSnapshotDetail(snapshotId)

        if (!snapshotDetail?.data) {
          throw new Error(t('mindmap.formatPanel.snapshot.errorDataEmpty'))
        }

        // 2. 智能转换：支持新格式（树结构）和旧格式（扁平对象）
        const treeData = convertSnapshotToTreeData(snapshotDetail.data as SnapshotDataInput)
        if (!treeData) {
          throw new Error(t('mindmap.formatPanel.snapshot.errorConvertFailed'))
        }

        // 3. 使用快照数据更新画布
        mindMap.updateData(treeData)

        // 4. 等待渲染完成后收起节点
        if (treeData.data && treeData.data.uid) {
          setTimeout(() => {
            mindMap.execCommand('UNEXPAND_ALL', false, treeData.data.uid)
          }, 0)
        }

        // 5. 关闭预览 Modal
        handleClosePreview()

        toast({
          description: t('mindmap.formatPanel.snapshot.toastRestoreSuccessCloudDesc')
        })
      } catch (error) {
        logger.error('恢复快照失败:', error)
        toast({
          title: t('mindmap.formatPanel.snapshot.toastRestoreFailedTitle'),
          description:
            error instanceof Error
              ? error.message
              : t('mindmap.formatPanel.snapshot.toastRestoreFailedUnknown'),
          variant: 'destructive'
        })
      } finally {
        setRestoring(false)
      }
    },
    [snapshots, mindMap, getSnapshotDetail, handleClosePreview, toast]
  )

  if (!workspaceId) {
    return (
      <Empty className="p-4">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Camera />
          </EmptyMedia>
          <EmptyDescription>
            {t('mindmap.formatPanel.snapshot.cloudRequireProject')}
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  return (
    <div className="fixed top-[68px] right-4 bg-card rounded-lg shadow-lg border border-border w-[320px] z-10 bottom-[30px]">
      <div className="flex flex-col h-full">
        {/* 头部 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Cloud className="size-5 text-primary" />
            <div className="text-base font-medium text-foreground">
              {t('mindmap.formatPanel.snapshot.cloudTitle')}
            </div>
          </div>

          <Button
            onClick={() => setCreateModalOpen(true)}
            disabled={creating}
            size="sm"
            className="h-7 text-xs"
          >
            <Plus className="size-3 mr-1" />
            {creating ? t('mindmap.formatPanel.snapshot.creating') : t('common.create')}
          </Button>
        </div>

        {/* 快照列表 */}
        <div className="flex-1 overflow-y-auto p-3">
          {loading ? (
            <div className="text-center text-muted-foreground py-8">
              <Spinner className="size-6 text-primary mx-auto mb-2" />
              <p>{t('common.loading')}</p>
            </div>
          ) : snapshots.length === 0 ? (
            <Empty className="border-none py-8">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Cloud />
                </EmptyMedia>
                <EmptyTitle>{t('mindmap.formatPanel.snapshot.cloudEmptyList')}</EmptyTitle>
                <EmptyDescription>
                  {t('mindmap.formatPanel.snapshot.cloudEmptyHint')}
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <div className="space-y-2">
              {snapshots.map(snapshot => (
                <motion.div
                  key={snapshot.id}
                  className="group p-2 rounded-lg transition-all duration-200 relative cursor-pointer bg-muted/50 hover:bg-muted"
                  whileHover={{ scale: 1.01 }}
                  transition={{ duration: 0.2 }}
                  onClick={() => handlePreview(snapshot)}
                >
                  {/* 内容区域 */}
                  <div className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-medium text-muted-foreground">
                          {t('mindmap.formatPanel.snapshot.snapshotLabel')}
                        </span>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Calendar className="size-3" />
                            {new Date(snapshot.createdAt).toLocaleDateString('zh-CN', {
                              month: '2-digit',
                              day: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                          <span>v{snapshot.version}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Archive className="size-4 text-foreground stroke-2 flex-shrink-0" />
                        <h4 className="font-medium text-base truncate text-foreground">
                          {snapshot.name}
                        </h4>
                      </div>
                    </div>
                  </div>

                  {/* 操作按钮 - hover时显示 */}
                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-all duration-200 transform translate-x-2 group-hover:translate-x-0">
                    <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                      <button
                        type="button"
                        className="p-1 rounded-full hover:bg-foreground/10 transition-colors"
                        onClick={() => handlePreview(snapshot)}
                        title={t('mindmap.formatPanel.snapshot.previewTooltip')}
                      >
                        <Eye className="size-4 text-muted-foreground" />
                      </button>

                      {/* 恢复按钮 - 所有快照都可以恢复 */}
                      <button
                        type="button"
                        className="p-1 rounded-full hover:bg-foreground/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        onClick={e => {
                          e.stopPropagation()
                          setSelectedSnapshot(snapshot)
                          setRestoreModalOpen(true)
                        }}
                        disabled={restoring}
                        title={t('mindmap.formatPanel.snapshot.restoreTooltip')}
                      >
                        <RotateCcw className="size-4 text-muted-foreground" />
                      </button>

                      {/* 删除按钮 - 只有手动快照可以删除 */}
                      {!snapshot.isAuto && (
                        <button
                          type="button"
                          className="p-1 rounded-full hover:bg-destructive/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          onClick={e => {
                            e.stopPropagation()
                            setSelectedSnapshot(snapshot)
                            setDeleteModalOpen(true)
                          }}
                          disabled={deleting}
                          title={t('common.delete')}
                        >
                          <X className="size-4 text-destructive hover:text-destructive" />
                        </button>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* 底部说明 */}
        <div className="px-3 py-2 border-t border-border bg-muted/50">
          <div className="text-xs text-muted-foreground space-y-1">
            <div className="flex items-center gap-2">
              <Cloud className="size-3" />
              <span>{t('mindmap.formatPanel.snapshot.footerCloud')}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="size-3" />
              <span>{t('mindmap.formatPanel.snapshot.footerAutoCloud')}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 创建快照模态框 */}
      {createModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card rounded-lg p-6 w-96 max-w-[90vw] border border-border">
            <h3 className="text-lg font-semibold mb-4 text-foreground">
              {t('mindmap.formatPanel.snapshot.createDialogTitle')}
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1 text-foreground">
                  {t('mindmap.formatPanel.snapshot.snapshotNameLabel')}
                </label>
                <Input
                  value={newSnapshotName}
                  onChange={e => setNewSnapshotName(e.target.value)}
                  placeholder={t('mindmap.formatPanel.snapshot.snapshotNamePlaceholderCloud')}
                  maxLength={100}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1 text-foreground">
                  {t('mindmap.formatPanel.snapshot.descriptionLabel')}
                </label>
                <Textarea
                  value={newSnapshotDescription}
                  onChange={e => setNewSnapshotDescription(e.target.value)}
                  placeholder={t('mindmap.formatPanel.snapshot.descriptionPlaceholderCloud')}
                  rows={3}
                  maxLength={500}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <Button
                variant="outline"
                onClick={() => {
                  setCreateModalOpen(false)
                  setNewSnapshotName('')
                  setNewSnapshotDescription('')
                }}
                disabled={creating}
              >
                {t('common.cancel')}
              </Button>
              <Button onClick={handleCreateSnapshot} disabled={creating || !newSnapshotName.trim()}>
                {creating ? t('mindmap.formatPanel.snapshot.creating') : t('common.create')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 删除确认模态框 */}
      {deleteModalOpen && selectedSnapshot && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card rounded-lg p-6 w-96 max-w-[90vw] border border-border">
            <h3 className="text-lg font-semibold mb-4 text-foreground">
              {t('mindmap.formatPanel.snapshot.deleteCloudTitle')}
            </h3>
            <p className="text-muted-foreground mb-6">
              {t('mindmap.formatPanel.snapshot.deleteConfirmCloud', {
                name: selectedSnapshot.name
              })}
            </p>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setDeleteModalOpen(false)
                  setSelectedSnapshot(null)
                }}
                disabled={deleting}
              >
                {t('common.cancel')}
              </Button>
              <Button variant="destructive" onClick={handleDeleteConfirm} disabled={deleting}>
                {deleting ? t('mindmap.formatPanel.snapshot.deleting') : t('common.delete')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 恢复确认模态框 */}
      {restoreModalOpen && selectedSnapshot && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card rounded-lg p-6 w-96 max-w-[90vw] border border-border">
            <h3 className="text-lg font-semibold mb-4 text-foreground">
              {t('mindmap.formatPanel.snapshot.restoreCloudTitle')}
            </h3>
            <p className="text-muted-foreground mb-6">
              {t('mindmap.formatPanel.snapshot.restoreConfirmCloud', {
                name: selectedSnapshot.name
              })}
            </p>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setRestoreModalOpen(false)
                  setSelectedSnapshot(null)
                }}
                disabled={restoring}
              >
                {t('common.cancel')}
              </Button>
              <Button onClick={handleRestoreConfirm} disabled={restoring}>
                {restoring
                  ? t('mindmap.formatPanel.snapshot.restoring')
                  : t('mindmap.formatPanel.snapshot.restoreTooltip')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 预览 Modal */}
      <SnapshotPreviewModal
        open={previewModalOpen}
        onClose={handleClosePreview}
        snapshot={previewSnapshot}
        onRestore={handleRestoreFromPreview}
        restoring={restoring}
      />
    </div>
  )
}
