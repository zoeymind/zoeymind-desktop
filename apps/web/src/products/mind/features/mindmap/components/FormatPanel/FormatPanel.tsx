import { logger } from '@zoeymind/logger'
import { useTranslation } from '@zoeymind/i18n'
import { useEffect, forwardRef, useImperativeHandle } from 'react'
import { Tags } from './Tags'
import { ThemePanel } from './ThemePanel'
import { SnapshotPanel } from './SnapshotPanel'
import { CommentPanel } from './CommentPanel'
import { AIFeaturePanel, useAIProcessing } from '@zoeymind-ext-mind'
import { useFeature } from '@/shared/app-shared'
import { MessageCircle, Sparkles } from 'lucide-react'
import { useUIStore } from '@/products/mind/stores'
import { useMindMapStore } from '@/products/mind/features/mindmap/stores/mindmap-store'
import { usePermissionStore } from '@/products/mind/features/mindmap/stores/permission-store'
import { useCommentContext } from '@/products/mind/features/mindmap/contexts/CommentContext'
import {
  FloatingToolbar,
  FloatingToolbarGroup,
  FloatingToolbarSeparator,
  FloatingToolbarButton
} from '@zoeymind/ui'
import { Badge } from '@zoeymind/ui'

interface FormatPanelProps {
  onPreviewStateChange?: (isPreview: boolean) => void
  setExitPreviewCallback?: (callback: (() => void) | null) => void
}

export interface FormatPanelRef {
  openTagsPanel: () => void
  closeTagsPanel: () => void
  toggleTagsPanel: () => void
  openCommentPanel: () => void
  openCommentPanelForNode: (nodeUid: string) => void
  closeCommentPanel: () => void
}

export const FormatPanel = forwardRef<FormatPanelRef, FormatPanelProps>(
  ({ onPreviewStateChange, setExitPreviewCallback }, ref) => {
    const { t } = useTranslation()
    // 从stores获取状态和数据
    const { mindMap } = useMindMapStore()
    const canEdit = usePermissionStore(state => state.canEdit)
    const {
      activeFormatTab: activeTab,
      targetNodeUid,
      openFormatTab,
      closeFormatTab,
      toggleFormatTab
    } = useUIStore()
    const { totalComments } = useCommentContext()
    const hasAiAgent = useFeature('ai-agent')
    const aiIsProcessing = useAIProcessing()
    const showAiTab = canEdit && hasAiAgent

    // 暴露方法给父组件
    useImperativeHandle(
      ref,
      () => ({
        openTagsPanel: () => openFormatTab('tags'),
        closeTagsPanel: () => closeFormatTab(),
        toggleTagsPanel: () => toggleFormatTab('tags'),
        openCommentPanel: () => openFormatTab('comment'),
        openCommentPanelForNode: (nodeUid: string) => openFormatTab('comment', nodeUid),
        closeCommentPanel: () => closeFormatTab()
      }),
      [openFormatTab, closeFormatTab, toggleFormatTab]
    )

    useEffect(() => {
      logger.debug('FormatPanel: mindMap状态', {
        exists: !!mindMap,
        workspaceId: (mindMap as { workspaceId?: string } | null)?.workspaceId,
        hasRenderer: !!mindMap?.renderer
      })
    }, [mindMap])

    useEffect(() => {
      // 只读用户切到只有 owner 可用的 tab 时自动收起 (tags/theme/ai/snapshot 都是编辑向面板)
      if (
        !canEdit &&
        (activeTab === 'ai' ||
          activeTab === 'snapshot' ||
          activeTab === 'theme' ||
          activeTab === 'tags')
      ) {
        closeFormatTab()
      }
    }, [canEdit, activeTab, closeFormatTab])

    return (
      <>
        <FloatingToolbar position="top-right">
          {/* 主工具栏 */}
          <FloatingToolbarGroup>
            {showAiTab && (
              <>
                <FloatingToolbarButton
                  active={activeTab === 'ai'}
                  onClick={() => toggleFormatTab('ai')}
                  title={t('mindmap.formatPanel.toolbar.aiAssistant')}
                  data-tour="ai-button"
                >
                  <div className="relative">
                    <Sparkles className="size-5" />
                    {/* 后台 Agent 跑着时, 角标 pulsing dot 提示 */}
                    {aiIsProcessing && (
                      <span className="absolute -top-0.5 -right-0.5 size-1.5 rounded-full bg-primary animate-pulse" />
                    )}
                  </div>
                </FloatingToolbarButton>
                <FloatingToolbarSeparator />
              </>
            )}

            {canEdit && (
              <FloatingToolbarButton
                active={activeTab === 'tags'}
                onClick={() => toggleFormatTab('tags')}
                title={t('mindmap.formatPanel.toolbar.tags')}
              >
                <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <circle cx="12" cy="12" r="10" strokeWidth="2" />
                  <path strokeLinecap="round" strokeWidth="2" d="M8 14s1.5 2 4 2 4-2 4-2" />
                  <circle cx="9" cy="9" r="1" fill="currentColor" />
                  <circle cx="15" cy="9" r="1" fill="currentColor" />
                </svg>
              </FloatingToolbarButton>
            )}

            {canEdit && (
              <FloatingToolbarButton
                active={activeTab === 'theme'}
                onClick={() => toggleFormatTab('theme')}
                title={t('common.themePreset')}
              >
                <svg
                  className="size-5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                  />
                </svg>
              </FloatingToolbarButton>
            )}

            {canEdit && (
              <FloatingToolbarButton
                active={activeTab === 'snapshot'}
                onClick={() => toggleFormatTab('snapshot')}
                title={t('mindmap.formatPanel.toolbar.snapshot')}
              >
                <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <circle cx="12" cy="12" r="10" strokeWidth="2" />
                  <polyline
                    points="12,6 12,12 16,14"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </FloatingToolbarButton>
            )}

            <FloatingToolbarButton
              active={activeTab === 'comment'}
              onClick={() => toggleFormatTab('comment')}
              title={t('mindmap.formatPanel.toolbar.comment')}
            >
              <div className="relative">
                <MessageCircle className="size-5" />
                {totalComments > 0 && (
                  <Badge
                    variant="default"
                    className="absolute -top-1 -right-1 h-4 min-w-4 px-1 flex items-center justify-center text-[10px] leading-none"
                  >
                    {totalComments > 99 ? '99+' : totalComments}
                  </Badge>
                )}
              </div>
            </FloatingToolbarButton>
          </FloatingToolbarGroup>
        </FloatingToolbar>

        {/* 面板内容 - 直接渲染，不包裹在FloatingToolbarContent中 */}
        {canEdit && activeTab === 'tags' && <Tags isActive={true} />}
        {canEdit && activeTab === 'theme' && <ThemePanel isActive={true} />}
        {/* AI 面板始终渲染, 内部用 display:none 收起 — 后台流不会被卸载中断 */}
        {showAiTab && <AIFeaturePanel isActive={activeTab === 'ai'} />}
        {canEdit && activeTab === 'snapshot' && (
          <SnapshotPanel
            isActive={true}
            onPreviewStateChange={onPreviewStateChange}
            setExitPreviewCallback={setExitPreviewCallback}
          />
        )}
        {activeTab === 'comment' && (
          <CommentPanel isActive={true} targetNodeUid={targetNodeUid} onClose={closeFormatTab} />
        )}
      </>
    )
  }
)
