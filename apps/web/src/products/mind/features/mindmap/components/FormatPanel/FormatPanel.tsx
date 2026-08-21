// @ts-nocheck — cloud/collab type debt; runtime gated by no-op shims
import { logger } from "@zoeymind/logger"
import { useTranslation } from "@zoeymind/i18n"
import { useEffect, forwardRef, useImperativeHandle } from "react"
import { Tags } from "./Tags"
import { useFeature } from "@/shared/app-shared"
import { useUIStore } from "@/products/mind/stores"
import { useProjectMindMapStore as useMindMapStore } from "@/products/mind/editor-session"
import { usePermissionStore } from "@/products/mind/features/mindmap/stores/permission-store"
import { useCommentContext } from "@/products/mind/features/mindmap/contexts/CommentContext"
import {
  Badge,
  FloatingToolbar,
  FloatingToolbarButton,
  FloatingToolbarGroup,
  MetallicButton,
  Tooltip,
  TooltipProvider,
  TooltipTrigger,
  useTheme,
} from "@zoeymind/ui"
import { EditorSidebarTooltipContent } from "../EditorSidebarTooltipContent"
import zoeyLogoLightUrl from "@/assets/logo.svg"
import zoeyLogoDarkUrl from "@/assets/logo-dark.svg"

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

export const FormatPanel = forwardRef<FormatPanelRef, FormatPanelProps>((_props, ref) => {
  const { t } = useTranslation()
  // 从stores获取状态和数据
  const { mindMap } = useMindMapStore()
  const canEdit = usePermissionStore(state => state.canEdit)
  const {
    activeFormatTab: activeTab,
    targetNodeUid,
    openFormatTab,
    closeFormatTab,
    toggleFormatTab,
  } = useUIStore()
  const { totalComments } = useCommentContext()

  // 暴露方法给父组件
  useImperativeHandle(
    ref,
    () => ({
      openTagsPanel: () => openFormatTab("tags"),
      closeTagsPanel: () => closeFormatTab(),
      toggleTagsPanel: () => toggleFormatTab("tags"),
      openCommentPanel: () => openFormatTab("comment"),
      openCommentPanelForNode: (nodeUid: string) => openFormatTab("comment", nodeUid),
      closeCommentPanel: () => closeFormatTab(),
    }),
    [openFormatTab, closeFormatTab, toggleFormatTab]
  )

  useEffect(() => {
    logger.debug("FormatPanel: mindMap状态", {
      exists: !!mindMap,
      workspaceId: (mindMap as { workspaceId?: string } | null)?.workspaceId,
      hasRenderer: !!mindMap?.renderer,
    })
  }, [mindMap])

  useEffect(() => {
    // 只读用户切到只有 owner 可用的 tab 时自动收起 (tags/theme/ai/snapshot 都是编辑向面板)
    if (
      !canEdit &&
      (activeTab === "ai" ||
        activeTab === "snapshot" ||
        activeTab === "theme" ||
        activeTab === "tags")
    ) {
      closeFormatTab()
    }
  }, [canEdit, activeTab, closeFormatTab])

  return (
    <>
      <TooltipProvider>
        <FloatingToolbar position="custom">
          {/* Header 次级工具栏 */}
          <FloatingToolbarGroup orientation="horizontal" className="gap-1">
            {canEdit && (
              <Tooltip>
                <TooltipTrigger
                  render={
                    <FloatingToolbarButton
                      active={activeTab === "tags"}
                      onClick={() => toggleFormatTab("tags")}
                      aria-label={t("mindmap.formatPanel.toolbar.tags")}
                    >
                      <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <circle cx="12" cy="12" r="10" strokeWidth="2" />
                        <path strokeLinecap="round" strokeWidth="2" d="M8 14s1.5 2 4 2 4-2 4-2" />
                        <circle cx="9" cy="9" r="1" fill="currentColor" />
                        <circle cx="15" cy="9" r="1" fill="currentColor" />
                      </svg>
                    </FloatingToolbarButton>
                  }
                />
                <EditorSidebarTooltipContent>
                  {t("mindmap.formatPanel.toolbar.tags")}
                </EditorSidebarTooltipContent>
              </Tooltip>
            )}
          </FloatingToolbarGroup>
        </FloatingToolbar>
      </TooltipProvider>

      {/* 面板内容 - 直接渲染，不包裹在FloatingToolbarContent中 */}
      {canEdit && activeTab === "tags" && <Tags isActive={true} />}
    </>
  )
})

export function AIChatToggle(): React.JSX.Element | null {
  const { t } = useTranslation()
  const canEdit = usePermissionStore(state => state.canEdit)
  const hasAiAgent = useFeature("ai-agent")
  const activeTab = useUIStore(state => state.activeFormatTab)
  const toggleFormatTab = useUIStore(state => state.toggleFormatTab)
  const { resolvedTheme } = useTheme()
  const zoeyLogoUrl = resolvedTheme === "dark" ? zoeyLogoDarkUrl : zoeyLogoLightUrl

  if (!canEdit || !hasAiAgent) return null

  return (
    <div
      aria-hidden={activeTab === "ai"}
      className={
        activeTab === "ai"
          ? "w-0 shrink-0 overflow-hidden opacity-0 pointer-events-none"
          : "w-auto shrink-0 overflow-visible opacity-100"
      }
    >
      <MetallicButton
        type="button"
        size="default"
        onClick={() => toggleFormatTab("ai")}
        metalTheme={resolvedTheme}
        disabled={activeTab === "ai"}
        tabIndex={activeTab === "ai" ? -1 : 0}
        aria-expanded={activeTab === "ai"}
        aria-label={t("mindmap.formatPanel.toolbar.aiAssistant")}
        data-tour="ai-button"
        className="h-8 gap-2 text-xs"
      >
        <img
          aria-hidden="true"
          src={zoeyLogoUrl}
          alt=""
          className="size-4 shrink-0 object-contain"
        />
        <span>Zoey Agent</span>
      </MetallicButton>
    </div>
  )
}
