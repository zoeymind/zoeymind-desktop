// @ts-nocheck — cloud/collab-heavy legacy; runtime behavior gated by no-op shims
import { useEffect, useRef, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@zoeymind/ui'
import { Button } from '@zoeymind/ui'
import { RotateCcw, X } from 'lucide-react'
import MindMap from 'simple-mind-map'
import { logger } from '@zoeymind/logger'
import { useTranslation } from '@zoeymind/i18n'
import type { CloudSnapshotDetail } from './hooks/useCloudSnapshot'
import {
  convertSnapshotToTreeData,
  type SnapshotDataInput
} from '@/products/mind/features/mindmap/utils/snapshotData'

interface SnapshotPreviewModalProps {
  open: boolean
  onClose: () => void
  snapshot: CloudSnapshotDetail | null
  onRestore?: (snapshotId: string) => void
  restoring?: boolean
}

/**
 * 快照预览弹窗组件
 * 使用独立的 MindMap 实例来预览快照数据,不影响主画布的协同状态
 */
export function SnapshotPreviewModal({
  open,
  onClose,
  snapshot,
  onRestore,
  restoring = false
}: SnapshotPreviewModalProps) {
  const { t } = useTranslation()
  const containerRef = useRef<HTMLDivElement>(null)
  const mindMapRef = useRef<MindMap | null>(null)
  const [loading, setLoading] = useState(true) // 默认 loading,等待数据

  // 当没有 snapshot 数据时显示 loading
  // loading 初始值已是 true，此 effect 冗余

  // 初始化预览画布
  useEffect(() => {
    if (!open || !snapshot) {
      return
    }

    let timeoutId: NodeJS.Timeout | null = null
    let cleanupTimeout = false

    const initializePreview = async () => {
      setLoading(true)

      try {
        // 清理之前的实例
        if (mindMapRef.current) {
          mindMapRef.current.destroy()
          mindMapRef.current = null
        }

        // 等待下一个事件循环,确保 DOM 已经渲染
        await new Promise(resolve => setTimeout(resolve, 100))

        const container = containerRef.current
        if (!container) {
          logger.error('Container ref is null after delay')
          setLoading(false)
          return
        }

        // 获取容器尺寸
        const rect = container.getBoundingClientRect()

        // 🔑 智能转换：支持新格式（树结构）和旧格式（扁平对象）
        const treeData = snapshot.data
          ? convertSnapshotToTreeData(snapshot.data as SnapshotDataInput)
          : { data: { text: t('mindmap.canvas.emptySnapshot') }, children: [] }

        if (!treeData) {
          logger.error('Failed to convert snapshot data to tree structure')
          setLoading(false)
          return
        }

        // 创建只读的 MindMap 实例用于预览
        const mindMapOptions = {
          el: container,
          data: treeData,
          width: rect.width || 800,
          height: rect.height || 600,
          layout: 'logicalStructure',
          readonly: true,
          layoutDirection: 2,
          useLeftKeySelectionRightKeyDrag: true,
          dragTargetType: 'canvas',
          alwaysShowExpandBtn: false,
          isLimitMindMapInCanvasWhenHasScrollbar: true,
          keyboardNavigationMoveToCenter: false
        }

        const instance = new MindMap(mindMapOptions)

        mindMapRef.current = instance

        // 监听渲染完成事件
        const handleRenderComplete = () => {
          if (cleanupTimeout) return
          if (timeoutId) clearTimeout(timeoutId)
          setLoading(false)

          // 如果有视图数据,应用视图变换
          if (snapshot.viewData) {
            const viewData = snapshot.viewData as {
              scale?: number
              translateX?: number
              translateY?: number
            }
            if (
              viewData.scale &&
              viewData.translateX !== undefined &&
              viewData.translateY !== undefined
            ) {
              instance.view.setTransformData({
                scale: viewData.scale,
                translateX: viewData.translateX,
                translateY: viewData.translateY
              })
              instance.render()
            }
          }
        }

        // 监听第一次渲染完成
        instance.on('node_tree_render_end', handleRenderComplete)

        // 手动触发渲染
        instance.render()

        // 设置一个超时作为后备,以防事件没有触发
        timeoutId = setTimeout(() => {
          if (!cleanupTimeout) {
            logger.warn('Preview render timeout, forcing loading to complete')
            setLoading(false)
          }
        }, 2000)
      } catch (error) {
        logger.error('Failed to initialize preview canvas:', error)
        setLoading(false)
      }
    }

    initializePreview()

    // 清理函数
    return () => {
      cleanupTimeout = true
      if (timeoutId) clearTimeout(timeoutId)
      if (mindMapRef.current) {
        mindMapRef.current.destroy()
        mindMapRef.current = null
      }
    }
  }, [open, snapshot])

  // 处理窗口大小变化
  useEffect(() => {
    if (!open) return

    const handleResize = () => {
      if (mindMapRef.current) {
        mindMapRef.current.resize()
      }
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [open])

  const handleRestore = () => {
    if (snapshot && onRestore) {
      onRestore(snapshot.id)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      {open && (
        <DialogContent className="sm:max-w-[95vw] sm:max-w-[95vw] max-h-[95vh] h-[95vh] p-0 gap-0 flex flex-col">
          <DialogHeader className="px-6 py-3 border-b flex-shrink-0">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="text-lg font-semibold">
                  {snapshot?.name || t('mindmap.canvas.snapshotPreviewTitle')}
                </DialogTitle>
                {snapshot?.description && (
                  <p className="text-sm text-muted-foreground mt-1">{snapshot.description}</p>
                )}
                <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                  {snapshot?.creator && (
                    <span>
                      {t('mindmap.canvas.snapshotCreator', {
                        name: snapshot.creator.name || t('mindmap.canvas.snapshotUnknownCreator')
                      })}
                    </span>
                  )}
                  {snapshot?.createdAt && (
                    <span>
                      {t('mindmap.canvas.snapshotCreatedAt', {
                        time: new Date(snapshot.createdAt).toLocaleString()
                      })}
                    </span>
                  )}
                  {snapshot?.nodeCount !== undefined && (
                    <span>
                      {t('mindmap.canvas.snapshotNodeCount', { count: snapshot.nodeCount })}
                    </span>
                  )}
                  {snapshot?.isAuto && (
                    <span className="px-2 py-0.5 bg-primary/10 text-primary rounded">
                      {t('mindmap.canvas.snapshotAutoTag')}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {onRestore && (
                  <Button onClick={handleRestore} disabled={restoring} size="sm" className="gap-2">
                    <RotateCcw className="size-4" />
                    {restoring
                      ? t('mindmap.canvas.snapshotRestoring')
                      : t('mindmap.canvas.snapshotRestore')}
                  </Button>
                )}
                <Button onClick={onClose} variant="ghost" size="sm" className="gap-2">
                  <X className="size-4" />
                  {t('common.close')}
                </Button>
              </div>
            </div>
          </DialogHeader>

          {/* 预览画布容器 */}
          <div className="flex-1 relative bg-muted overflow-hidden">
            {loading && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10">
                <div className="flex flex-col items-center gap-2">
                  <div className="size-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                  <span className="text-sm text-muted-foreground">
                    {t('mindmap.canvas.loadingPreview')}
                  </span>
                </div>
              </div>
            )}
            <div ref={containerRef} className="w-full h-full absolute inset-0" />
          </div>
        </DialogContent>
      )}
    </Dialog>
  )
}