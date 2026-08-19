// @ts-nocheck — cloud/collab type debt; runtime gated by no-op shims
import { logger } from '@zoeymind/logger'
import { useTranslation } from '@zoeymind/i18n'
import React, { useState, useEffect, useCallback } from 'react'
import { motion } from 'motion/react'
import {
  Clock,
  Camera,
  Eye,
  Plus,
  AlertTriangle,
  Cloud,
  HardDrive,
  RotateCcw,
  Archive,
  X
} from 'lucide-react'
import { PanelLayout } from './PanelLayout'
import {
  Button,
  Spinner,
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription
} from '@zoeymind/ui'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter
} from '@zoeymind/ui'
import { Input } from '@zoeymind/ui'
import { Textarea } from '@zoeymind/ui'
import { useToast } from '@/shared/app-shared'
import { projectDB } from '@/shared/mindmap-bridge'
import { CloudSnapshotPanel } from './CloudSnapshotPanel'
import { useProjectMindMapStore as useMindMapStore } from '@/products/mind/editor-session'
import { useProjectContext } from '@/products/mind/features/mindmap/contexts/ProjectContext'

interface SnapshotPanelProps {
  isActive: boolean
  onPreviewStateChange?: (isPreview: boolean) => void
  setExitPreviewCallback?: (callback: (() => void) | null) => void
}

interface Snapshot {
  id: string
  workspaceId: string
  name: string
  description?: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- 快照数据结构复杂且动态
  data: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- 视图数据包含缩放、平移等属性
  viewData?: any
  createdAt: Date
  isAuto: boolean
  version: number
}

export const SnapshotPanel: React.FC<SnapshotPanelProps> = ({
  isActive,
  onPreviewStateChange,
  setExitPreviewCallback
}) => {
  const { t } = useTranslation()
  // 🚀 从store获取mindMap实例和项目信息
  // 🎯 从 Context 获取 workspaceId 和 cloudMode (页面级作用域)
  const { workspaceId, cloudMode } = useProjectContext()
  const {
    mindMap,
    setPreviewMode,
    setExitPreviewCallback: setStoreExitPreviewCallback
  } = useMindMapStore()
  const [snapshotType, setSnapshotType] = useState<'local' | 'cloud'>(() => {
    return cloudMode ? 'cloud' : 'local'
  })

  // 当 cloudMode 变化时更新默认选择
  useEffect(() => {
    if (cloudMode && snapshotType === 'local') {
      setSnapshotType('cloud')
    }
  }, [cloudMode, snapshotType])
  const [snapshots, setSnapshots] = useState<Snapshot[]>([])
  const [loading, setLoading] = useState(false)
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [restoreModalOpen, setRestoreModalOpen] = useState(false)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [selectedSnapshot, setSelectedSnapshot] = useState<Snapshot | null>(null)
  const [newSnapshotName, setNewSnapshotName] = useState('')
  const [newSnapshotDescription, setNewSnapshotDescription] = useState('')
  const [isPreviewMode, setIsPreviewMode] = useState(false)
  const [previewingSnapshotId, setPreviewingSnapshotId] = useState<string | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- 原始数据结构动态，用于预览模式恢复
  const [originalData, setOriginalData] = useState<any>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- 原始视图数据结构动态，用于预览模式恢复
  const [originalViewData, setOriginalViewData] = useState<any>(null)
  const { toast } = useToast()

  // 加载快照列表
  const loadSnapshots = async () => {
    if (!workspaceId) return

    setLoading(true)
    try {
      const projectSnapshots = await projectDB.snapshots.getByProject(workspaceId)
      setSnapshots(projectSnapshots)
    } catch (error) {
      logger.error('加载快照列表失败:', error)
      toast({
        title: t('mindmap.formatPanel.snapshot.toastLoadFailedTitle'),
        description: t('mindmap.formatPanel.snapshot.toastLoadFailedDesc'),
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  // 创建手动快照
  const createSnapshot = async () => {
    if (!mindMap || !workspaceId || !newSnapshotName.trim()) return

    try {
      const mindMapData = mindMap.getData()
      const viewData = mindMap.view.getTransformData()

      await projectDB.snapshots.create(
        workspaceId,
        newSnapshotName.trim(),
        mindMapData,
        viewData,
        false, // 手动快照
        newSnapshotDescription.trim() || undefined
      )

      toast({
        description: t('mindmap.formatPanel.snapshot.toastCreatedDesc', { name: newSnapshotName })
      })

      // 重置表单
      setNewSnapshotName('')
      setNewSnapshotDescription('')
      setCreateModalOpen(false)

      // 重新加载快照列表
      loadSnapshots()
    } catch (error) {
      logger.error('创建快照失败:', error)
      toast({
        title: t('mindmap.formatPanel.snapshot.toastCreateFailedTitle'),
        description: t('mindmap.formatPanel.snapshot.toastCreateFailedDesc'),
        variant: 'destructive'
      })
    }
  }

  // 预览快照
  const previewSnapshot = async (snapshot: Snapshot) => {
    if (!mindMap) return

    try {
      // 保存当前数据
      const currentData = mindMap.getData()
      const currentViewData = mindMap.view.getTransformData()
      setOriginalData(currentData)
      setOriginalViewData(currentViewData)

      // 设置预览数据
      mindMap.setData(snapshot.data)
      if (snapshot.viewData) {
        mindMap.view.setTransformData(snapshot.viewData)
      }
      mindMap.render()

      // 设置为只读模式
      mindMap.setMode('readonly')

      // 进入预览模式
      setIsPreviewMode(true)
      setPreviewingSnapshotId(snapshot.id)
      setPreviewMode(true)
      onPreviewStateChange?.(true)

      toast({
        description: t('mindmap.formatPanel.snapshot.toastPreviewDesc', { name: snapshot.name })
      })
    } catch (error) {
      logger.error('预览快照失败:', error)
      toast({
        title: t('mindmap.formatPanel.snapshot.toastPreviewFailedTitle'),
        description: t('mindmap.formatPanel.snapshot.toastPreviewFailedDesc'),
        variant: 'destructive'
      })
    }
  }

  // 退出预览模式
  const exitPreview = useCallback(async () => {
    if (!mindMap || !originalData) return

    try {
      // 恢复原始数据
      mindMap.setData(originalData)
      if (originalViewData) {
        mindMap.view.setTransformData(originalViewData)
      }
      mindMap.render()

      // 恢复编辑模式
      mindMap.setMode('edit')

      // 退出预览模式
      setIsPreviewMode(false)
      setPreviewingSnapshotId(null)
      setOriginalData(null)
      setOriginalViewData(null)
      setPreviewMode(false)
      onPreviewStateChange?.(false)

      toast({
        description: t('mindmap.formatPanel.snapshot.toastExitPreviewDesc')
      })
    } catch (error) {
      logger.error('退出预览失败:', error)
      toast({
        title: t('mindmap.formatPanel.snapshot.toastExitPreviewFailedTitle'),
        description: t('mindmap.formatPanel.snapshot.toastExitPreviewFailedDesc'),
        variant: 'destructive'
      })
    }
  }, [mindMap, originalData, originalViewData, setPreviewMode, onPreviewStateChange, toast])

  // 打开恢复确认对话框
  const handleRestoreClick = (snapshot: Snapshot) => {
    setSelectedSnapshot(snapshot)
    setRestoreModalOpen(true)
  }

  // 打开删除确认对话框
  const handleDeleteClick = (snapshot: Snapshot) => {
    setSelectedSnapshot(snapshot)
    setDeleteModalOpen(true)
  }

  // 恢复快照
  const restoreSnapshot = async () => {
    if (!mindMap || !selectedSnapshot) return

    try {
      // 设置思维导图数据
      mindMap.setData(selectedSnapshot.data)

      // 恢复视图状态
      if (selectedSnapshot.viewData) {
        mindMap.view.setTransformData(selectedSnapshot.viewData)
      }

      // 重新渲染
      mindMap.render()

      toast({
        description: t('mindmap.formatPanel.snapshot.toastRestoreSuccessDesc', {
          name: selectedSnapshot.name
        })
      })

      // 关闭对话框
      setRestoreModalOpen(false)
      setSelectedSnapshot(null)
    } catch (error) {
      logger.error('恢复快照失败:', error)
      toast({
        title: t('mindmap.formatPanel.snapshot.toastRestoreFailedTitle'),
        description: t('mindmap.formatPanel.snapshot.toastRestoreFailedDesc'),
        variant: 'destructive'
      })
    }
  }

  // 删除快照
  const deleteSnapshot = async () => {
    if (!selectedSnapshot) return

    try {
      await projectDB.snapshots.delete(selectedSnapshot.id)

      toast({
        description: t('mindmap.formatPanel.snapshot.toastDeletedDesc', {
          name: selectedSnapshot.name
        })
      })

      // 关闭对话框
      setDeleteModalOpen(false)
      setSelectedSnapshot(null)

      // 重新加载快照列表
      loadSnapshots()
    } catch (error) {
      logger.error('删除快照失败:', error)
      toast({
        title: t('mindmap.formatPanel.snapshot.toastDeleteFailedTitle'),
        description: t('mindmap.formatPanel.snapshot.toastDeleteFailedDesc'),
        variant: 'destructive'
      })
    }
  }

  // 格式化时间
  const formatTime = (date: Date) => {
    return new Date(date).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  // 当面板激活时加载数据
  useEffect(() => {
    if (isActive && workspaceId) {
      loadSnapshots()
    }
  }, [isActive, workspaceId])

  // 设置退出预览的回调 - 同时设置给props和store
  useEffect(() => {
    if (snapshotType === 'local') {
      // 设置给props回调（兼容性）
      setExitPreviewCallback?.(exitPreview)
      // 设置给store回调（新的方式）
      setStoreExitPreviewCallback(exitPreview)
    }
  }, [setExitPreviewCallback, setStoreExitPreviewCallback, exitPreview, snapshotType])

  if (!isActive) return null

  // 如果是云端快照，直接使用 CloudSnapshotPanel
  if (snapshotType === 'cloud') {
    return <CloudSnapshotPanel isActive={isActive} />
  }

  if (!workspaceId) {
    return (
      <PanelLayout
        title={t('mindmap.formatPanel.snapshot.panelTitle')}
        icon={<Camera className="size-5 text-primary" />}
        isActive={isActive}
      >
        <div className="p-4 text-center text-muted-foreground">
          <Camera className="size-8 mx-auto mb-2 opacity-50" />
          <p>{t('mindmap.formatPanel.snapshot.requireProject')}</p>
        </div>
      </PanelLayout>
    )
  }

  const customHeader = (
    <div className="flex items-center justify-between px-4 py-3 border-b">
      <div className="flex items-center gap-2">
        <Camera className="size-5 text-primary" />
        <div className="text-base font-medium">{t('mindmap.formatPanel.snapshot.panelTitle')}</div>
      </div>

      {/* 快照类型切换 */}
      {cloudMode && (
        <div className="flex items-center gap-1 mr-2">
          <Button
            size="sm"
            variant={snapshotType === 'local' ? 'default' : 'outline'}
            className="h-6 px-2 text-xs"
            onClick={() => setSnapshotType('local')}
          >
            <HardDrive className="size-3 mr-1" />
            {t('mindmap.formatPanel.snapshot.switchLocal')}
          </Button>
          <Button
            size="sm"
            variant={(snapshotType as string) === 'cloud' ? 'default' : 'outline'}
            className="h-6 px-2 text-xs"
            onClick={() => setSnapshotType('cloud')}
          >
            <Cloud className="size-3 mr-1" />
            {t('mindmap.formatPanel.snapshot.switchCloud')}
          </Button>
        </div>
      )}
      <Dialog open={createModalOpen} onOpenChange={setCreateModalOpen}>
        <DialogTrigger
          render={
            <Button size="sm" className="h-7 text-xs">
              <Plus className="size-3 mr-1" />
              {t('common.create')}
            </Button>
          }
        />
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('mindmap.formatPanel.snapshot.createDialogTitle')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">
                {t('mindmap.formatPanel.snapshot.snapshotNameLabel')}
              </label>
              <Input
                value={newSnapshotName}
                onChange={e => setNewSnapshotName(e.target.value)}
                placeholder={t('mindmap.formatPanel.snapshot.snapshotNamePlaceholder')}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">
                {t('mindmap.formatPanel.snapshot.descriptionLabel')}
              </label>
              <Textarea
                value={newSnapshotDescription}
                onChange={e => setNewSnapshotDescription(e.target.value)}
                placeholder={t('mindmap.formatPanel.snapshot.descriptionPlaceholder')}
                className="mt-1"
                rows={3}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setCreateModalOpen(false)}>
                {t('common.cancel')}
              </Button>
              <Button onClick={createSnapshot} disabled={!newSnapshotName.trim()}>
                {t('mindmap.formatPanel.snapshot.createConfirm')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )

  return (
    <PanelLayout isActive={isActive} customHeader={customHeader}>
      {/* 恢复确认对话框 */}
      <Dialog open={restoreModalOpen} onOpenChange={setRestoreModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="size-5 text-warning" />
              {t('mindmap.formatPanel.snapshot.restoreDialogTitle')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-warning/10 border border-warning/20 rounded-lg p-3">
              <p className="text-sm text-warning">
                <strong>{t('mindmap.formatPanel.snapshot.restoreWarning')}</strong>
                {t('mindmap.formatPanel.snapshot.restoreWarningBody')}
              </p>
            </div>
            {selectedSnapshot && (
              <div className="space-y-2">
                <div>
                  <span className="text-sm font-medium">
                    {t('mindmap.formatPanel.snapshot.snapshotNameField')}
                  </span>
                  <span className="text-sm">{selectedSnapshot.name}</span>
                </div>
                <div>
                  <span className="text-sm font-medium">
                    {t('mindmap.formatPanel.snapshot.createdAtField')}
                  </span>
                  <span className="text-sm">{formatTime(selectedSnapshot.createdAt)}</span>
                </div>
                {selectedSnapshot.description && (
                  <div>
                    <span className="text-sm font-medium">
                      {t('mindmap.formatPanel.snapshot.descriptionField')}
                    </span>
                    <span className="text-sm">{selectedSnapshot.description}</span>
                  </div>
                )}
              </div>
            )}
            <p className="text-sm text-muted-foreground">
              {t('mindmap.formatPanel.snapshot.restoreConfirmQuestion')}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRestoreModalOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={restoreSnapshot}>
              {t('mindmap.formatPanel.snapshot.restoreConfirmButton')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除确认对话框 */}
      <Dialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="size-5 text-destructive" />
              {t('mindmap.formatPanel.snapshot.deleteDialogTitle')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
              <p className="text-sm text-destructive">
                <strong>{t('mindmap.formatPanel.snapshot.restoreWarning')}</strong>
                {t('mindmap.formatPanel.snapshot.deleteWarningBody')}
              </p>
            </div>
            {selectedSnapshot && (
              <div className="space-y-2">
                <div>
                  <span className="text-sm font-medium">
                    {t('mindmap.formatPanel.snapshot.snapshotNameField')}
                  </span>
                  <span className="text-sm">{selectedSnapshot.name}</span>
                </div>
                <div>
                  <span className="text-sm font-medium">
                    {t('mindmap.formatPanel.snapshot.createdAtField')}
                  </span>
                  <span className="text-sm">{formatTime(selectedSnapshot.createdAt)}</span>
                </div>
                {selectedSnapshot.description && (
                  <div>
                    <span className="text-sm font-medium">
                      {t('mindmap.formatPanel.snapshot.descriptionField')}
                    </span>
                    <span className="text-sm">{selectedSnapshot.description}</span>
                  </div>
                )}
              </div>
            )}
            <p className="text-sm text-muted-foreground">
              {t('mindmap.formatPanel.snapshot.deleteConfirmQuestion')}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteModalOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={deleteSnapshot} variant="destructive">
              {t('mindmap.formatPanel.snapshot.deleteConfirmButton')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
                <Camera />
              </EmptyMedia>
              <EmptyTitle>{t('mindmap.formatPanel.snapshot.emptyList')}</EmptyTitle>
              <EmptyDescription>{t('mindmap.formatPanel.snapshot.emptyHint')}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="space-y-2">
            {snapshots.map(snapshot => (
              <motion.div
                key={snapshot.id}
                className={`group p-2 rounded-lg transition-all duration-200 relative cursor-pointer ${
                  previewingSnapshotId === snapshot.id
                    ? 'bg-primary/10 hover:bg-primary/15'
                    : 'bg-muted hover:bg-muted'
                }`}
                whileHover={{ scale: 1.01 }}
                transition={{ duration: 0.2 }}
                onClick={() => (isPreviewMode ? exitPreview() : previewSnapshot(snapshot))}
              >
                {/* 内容区域 */}
                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                          previewingSnapshotId === snapshot.id
                            ? 'bg-primary/10 text-primary'
                            : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {previewingSnapshotId === snapshot.id
                          ? t('mindmap.formatPanel.snapshot.statusPreviewing')
                          : t('mindmap.formatPanel.snapshot.statusNormal')}
                      </span>
                      <span className="text-xs font-medium text-muted-foreground">
                        {t('mindmap.formatPanel.snapshot.snapshotLabel')}
                      </span>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="size-3" />
                        {formatTime(snapshot.createdAt)}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {snapshot.isAuto ? (
                        <Archive className="size-4 text-black stroke-2 flex-shrink-0" />
                      ) : (
                        <Archive className="size-4 text-black stroke-2 flex-shrink-0" />
                      )}
                      <h4 className="font-medium text-base truncate">{snapshot.name}</h4>
                    </div>
                  </div>
                </div>

                {/* 操作按钮 - hover时显示 */}
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-all duration-200 transform translate-x-2 group-hover:translate-x-0">
                  <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                    <button
                      type="button"
                      className={`p-1 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                        previewingSnapshotId === snapshot.id
                          ? 'bg-primary/10 hover:bg-primary/20'
                          : 'hover:bg-black/10'
                      }`}
                      onClick={() =>
                        previewingSnapshotId === snapshot.id
                          ? exitPreview()
                          : previewSnapshot(snapshot)
                      }
                      title={
                        previewingSnapshotId === snapshot.id
                          ? t('mindmap.formatPanel.snapshot.exitPreviewTooltip')
                          : t('mindmap.formatPanel.snapshot.previewTooltip')
                      }
                    >
                      <Eye
                        className={`size-4 ${previewingSnapshotId === snapshot.id ? 'text-primary' : 'text-foreground'}`}
                      />
                    </button>
                    <button
                      type="button"
                      className="p-1 rounded-full hover:bg-black/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      onClick={() => handleRestoreClick(snapshot)}
                      disabled={isPreviewMode}
                      title={t('mindmap.formatPanel.snapshot.restoreTooltip')}
                    >
                      <RotateCcw className="size-4 text-foreground" />
                    </button>
                    {!snapshot.isAuto && (
                      <button
                        type="button"
                        className="p-1 rounded-full hover:bg-destructive/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        onClick={() => handleDeleteClick(snapshot)}
                        disabled={isPreviewMode}
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
      <div className="px-3 py-2 border-t border-border bg-muted">
        <div className="text-xs text-muted-foreground space-y-1">
          <div className="flex items-center gap-2">
            <Clock className="size-3" />
            <span>{t('mindmap.formatPanel.snapshot.footerAutoLocal')}</span>
          </div>
          <div className="flex items-center gap-2">
            <Camera className="size-3" />
            <span>{t('mindmap.formatPanel.snapshot.footerManualLocal')}</span>
          </div>
        </div>
      </div>
    </PanelLayout>
  )
}