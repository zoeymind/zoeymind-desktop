// @ts-nocheck — cloud/collab type debt; runtime gated by no-op shims
import { logger } from '@zoeymind/logger'
import React from 'react'
import { Compass, ZoomIn, ZoomOut, Hand } from 'lucide-react'
import {
  FloatingToolbar,
  FloatingToolbarGroup,
  FloatingToolbarSeparator,
  FloatingToolbarButton
} from '@zoeymind/ui'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@zoeymind/ui'
import { usePanTool } from '@/products/mind/features/mindmap/components/hooks/usePanTool'
import { useMindMapStore } from '@/products/mind/features/mindmap/stores/mindmap-store'
import { useTranslation } from '@zoeymind/i18n'

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
interface CanvasToolProps {}

export const CanvasTool: React.FC<CanvasToolProps> = () => {
  const { t } = useTranslation()
  // 从store获取mindMap实例
  const { mindMap } = useMindMapStore()
  // 使用手掌拖动工具hook
  const panTool = usePanTool()

  // 回到画布中心
  const handleCenterCanvas = () => {
    if (!mindMap) return

    try {
      // 使用思维导图的视图方法回到中心
      mindMap.view.reset()
      logger.info('画布已回到中心')
    } catch (error) {
      logger.error('回到画布中心失败:', error)
    }
  }

  // 放大画布
  const handleZoomIn = () => {
    if (!mindMap) return

    try {
      // 使用画布中心点进行缩放
      const centerX = window.innerWidth / 2
      const centerY = window.innerHeight / 2
      mindMap.view.enlarge(centerX, centerY, false)
      logger.info('画布已放大')
    } catch (error) {
      logger.error('放大画布失败:', error)
    }
  }

  // 缩小画布
  const handleZoomOut = () => {
    if (!mindMap) return

    try {
      // 使用画布中心点进行缩放
      const centerX = window.innerWidth / 2
      const centerY = window.innerHeight / 2
      mindMap.view.narrow(centerX, centerY, false)
      logger.info('画布已缩小')
    } catch (error) {
      logger.error('缩小画布失败:', error)
    }
  }

  return (
    <TooltipProvider>
      <FloatingToolbar position="custom" className="fixed bottom-10 left-4">
        <FloatingToolbarGroup>
          <Tooltip>
            <TooltipTrigger
              render={
                <FloatingToolbarButton onClick={handleCenterCanvas} disabled={!mindMap}>
                  <Compass className="size-5" />
                </FloatingToolbarButton>
              }
            />
            <TooltipContent side="top">{t('mindmap.canvasTool.centerCanvas')}</TooltipContent>
          </Tooltip>

          <FloatingToolbarSeparator />

          <Tooltip>
            <TooltipTrigger
              render={
                <FloatingToolbarButton
                  onClick={panTool.togglePanMode}
                  disabled={!mindMap}
                  active={panTool.isActive}
                >
                  <Hand className="size-5" />
                </FloatingToolbarButton>
              }
            />
            <TooltipContent side="top">
              {t('mindmap.canvasTool.panTool')}
              <br />
              {t('mindmap.canvasTool.panToolShortcut')}
            </TooltipContent>
          </Tooltip>

          <FloatingToolbarSeparator />

          <Tooltip>
            <TooltipTrigger
              render={
                <FloatingToolbarButton onClick={handleZoomIn} disabled={!mindMap}>
                  <ZoomIn className="size-5" />
                </FloatingToolbarButton>
              }
            />
            <TooltipContent side="top">{t('mindmap.canvasTool.zoomIn')}</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger
              render={
                <FloatingToolbarButton onClick={handleZoomOut} disabled={!mindMap}>
                  <ZoomOut className="size-5" />
                </FloatingToolbarButton>
              }
            />
            <TooltipContent side="top">{t('mindmap.canvasTool.zoomOut')}</TooltipContent>
          </Tooltip>
        </FloatingToolbarGroup>
      </FloatingToolbar>
    </TooltipProvider>
  )
}