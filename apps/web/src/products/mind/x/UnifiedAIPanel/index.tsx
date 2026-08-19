// @ts-nocheck — dormant AI chat / MCP module (bridge.tsx flattens to no-op)
/**
 * UnifiedAIPanel - AI 面板组件
 *
 * 使用 AIchatV2（基于 Vercel AI SDK）
 */

import React from "react"
import { useTranslation } from "@zoeymind/i18n"
import { Sparkles, GripVertical, Plus, History, Settings } from "lucide-react"
import { AIchatV2 } from "../ai-chat"
import { ContextUsageIndicator } from "../ai-chat/components/ContextUsageIndicator"
import { ChatHistoryPanel } from "../ai-chat/components/historyView/ChatHistoryPanel"
import { logger } from "@zoeymind/logger"
import { useProjectMindMapStore as useMindMapStore } from "@/products/mind/editor-session"
import { useAIChatV2Store } from "../ai-chat/stores/useAIChatV2Store"
import { useAIChatRuntime } from "../ai-chat/context/AIChatRuntimeContext"
import { useModelSelector } from "../ai-chat/hooks/useModelSelector"
import { useResizableWidth } from "../ai-chat/hooks/useResizableWidth"
import { cn } from "@/shared/app-shared"
interface UnifiedAIPanelProps {
  isActive?: boolean
}

const MIN_WIDTH = 300
const MAX_WIDTH = 800

export const UnifiedAIPanel: React.FC<UnifiedAIPanelProps> = ({ isActive }) => {
  const { t } = useTranslation()
  const { mindMap } = useMindMapStore()
  const {
    width,
    isDragging,
    onMouseDown: handleMouseDown,
  } = useResizableWidth({
    initial: 400,
    min: MIN_WIDTH,
    max: MAX_WIDTH,
  })

  const {
    showHistory,
    setShowHistory,
    currentConversationId,
    totalTokenUsage,
    createNewConversation,
    loadConversation,
    setShowSettings,
  } = useAIChatV2Store()
  const runtime = useAIChatRuntime()
  const isProcessing = runtime.status === "submitted" || runtime.status === "streaming"
  const { models, selectedModel } = useModelSelector()

  const handleCreateNewConversation = async () => {
    if (!(mindMap as { workspaceId?: string } | null)?.workspaceId) return
    try {
      await createNewConversation((mindMap as { workspaceId?: string } | null)!.workspaceId!)
      setShowHistory(false)
    } catch (error) {
      logger.error("UnifiedAIPanel: 创建新对话失败", error)
    }
  }

  const toggleHistory = () => {
    setShowHistory(!showHistory)
  }

  const handleSelectConversation = async (conversationId: string) => {
    try {
      await loadConversation(conversationId)
      setShowHistory(false)
    } catch (error) {
      logger.error("UnifiedAIPanel: 选择对话失败", error)
    }
  }

  // 收起面板时只隐藏 DOM, 不卸载 React tree. 这样 AIchatV2 内部的 useChat + 流式
  // fetch 不被中断, 后台继续跑. 用户切去做别的, Agent 继续工作, 重开面板看到完成态.
  return (
    <div
      className="fixed top-[var(--mind-floating-top,68px)] right-[var(--mind-floating-right,16px)] bottom-[var(--mind-floating-bottom,32px)] z-10 max-w-[var(--mind-floating-max-width,calc(100vw-32px))] overflow-hidden rounded-lg border border-border bg-card shadow-lg"
      style={{ width: `${width}px`, display: isActive ? "block" : "none" }}
    >
      <div className="flex flex-col h-full text-sm">
        {/* Header */}
        <div className="relative flex items-center px-3 py-2 border-b border-border">
          <div
            className={cn(
              "flex items-center justify-center size-5 mr-2 cursor-ew-resize rounded hover:bg-muted transition-colors",
              isDragging ? "bg-muted" : "bg-muted/50"
            )}
            onMouseDown={handleMouseDown}
          >
            <GripVertical className="size-3 text-muted-foreground" />
          </div>

          <div className="flex items-center gap-1 mr-2" data-tour="ai-panel-mode-switch">
            <Sparkles className="size-3.5 text-primary" />
            <span className="text-xs font-medium">Agent</span>
          </div>

          {/* Token 使用指示器 */}
          <div className="flex-1" />
          <div className="mr-2">
            <ContextUsageIndicator
              usedTokens={totalTokenUsage.total}
              maxTokens={models.find(m => m.id === selectedModel)?.maxContextTokens || 128000}
            />
          </div>

          {/* 操作按钮 */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setShowSettings(true)}
              className="flex items-center justify-center size-6 rounded hover:bg-muted transition-colors"
              title={t("mindmap.aiChat.input.caseReviewSettings")}
            >
              <Settings className="size-3 text-muted-foreground" />
            </button>
            <button
              type="button"
              onClick={handleCreateNewConversation}
              disabled={isProcessing}
              className={cn(
                "flex items-center justify-center size-6 rounded hover:bg-muted transition-colors",
                isProcessing && "opacity-40 cursor-not-allowed hover:bg-transparent"
              )}
              title={
                isProcessing
                  ? t("mindmap.aiChat.core.newConversationDisabledWhileProcessing")
                  : t("mindmap.formatPanel.aiPanel.newConversation")
              }
              data-tour="ai-panel-new-conversation"
            >
              <Plus className="size-3 text-muted-foreground" />
            </button>
            <button
              type="button"
              onClick={toggleHistory}
              disabled={isProcessing}
              className={cn(
                "flex items-center justify-center size-6 rounded hover:bg-muted transition-colors",
                showHistory && "bg-muted",
                isProcessing && "opacity-40 cursor-not-allowed hover:bg-transparent"
              )}
              title={
                isProcessing
                  ? t("mindmap.aiChat.core.historyDisabledWhileProcessing")
                  : t("mindmap.formatPanel.aiPanel.history")
              }
              data-tour="ai-panel-history"
            >
              <History className="size-3 text-muted-foreground" />
            </button>
          </div>

          {/* 历史聊天面板 */}
          <ChatHistoryPanel
            isOpen={showHistory}
            onClose={() => {
              setShowHistory(false)
            }}
            workspaceId={
              (mindMap as { workspaceId?: string } | null)?.workspaceId || "default-project"
            }
            onSelectConversation={handleSelectConversation}
            currentConversationId={currentConversationId}
          />
        </div>

        {/* 内容区域 */}
        <div className="flex-1 overflow-hidden relative rounded-b-lg">
          <div className="absolute inset-0 h-full w-full">
            <div data-unified-ai-content className="h-full rounded-b-lg overflow-hidden">
              <AIchatV2 isActive={true} embedded={true} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
