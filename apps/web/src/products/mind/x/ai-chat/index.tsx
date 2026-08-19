// @ts-nocheck — desktop mirror of cloud AI chat; runtime bridged via bridge.tsx
/**
 * AIchatV2 - 基于 Vercel AI SDK 的 AI 聊天组件
 *
 * 完全独立的实现，与旧版本并行
 * 所有状态通过 useAIChatV2Store 管理，组件间无 props 传递
 */

import React, { useEffect, useState } from 'react'
import type { McpServerItem, AiToolListResult, PromptItem } from '../lib/api-types'
import { GripVertical, ChevronDown, Plus, History, Bot, AlertCircle, Settings } from 'lucide-react'
import { Button } from '@zoeymind/ui'
import { MessageView } from './components/messageView'
import { InputView } from './components/inputView'
import { ContextUsageIndicator } from './components/ContextUsageIndicator'
import { ActivePromptsIndicator } from './components/ActivePromptsIndicator'
import { ChatHistoryPanel } from './components/historyView/ChatHistoryPanel'
import { AIChatSettingsDialog } from './components/inputView/AIChatSettingsDialog'
import { ErrorBoundary } from './components/ErrorBoundary'
import { MindMapInstanceProvider } from './context/MindMapInstanceContext'
import { ToolUIRenderer } from './context/ToolUIRenderer'
import { useQuestionToolUI } from './tools/ui-handlers/QuestionToolUI'
import { useCaseConfirmToolUI } from './tools/ui-handlers/CaseConfirmToolUI'
import { useResizableWidth } from './hooks/useResizableWidth'
import { useMCPTools } from './hooks/useMCPTools'
import { useModelSelector } from './hooks/useModelSelector'
import { useAIChatV2Store } from './stores/useAIChatV2Store'
import { useAIChatRuntime } from './context/AIChatRuntimeContext'
import { useMCPStore } from '../useMCPStore'
import { useMindMapStore } from '@/products/mind/features/mindmap/stores/mindmap-store'
import { cn } from '@/shared/app-shared'
import { trpc } from '../lib/trpc'
import { useTranslation } from '@zoeymind/i18n'
import { getMindmapContextEnabled, setMindmapContextEnabled } from './hooks/useUserPrompt'

const MIN_WIDTH = 300
const MAX_WIDTH = 800
const EMPTY_MCP_SERVERS: McpServerItem[] = []

interface AIchatV2Props {
  isActive?: boolean
  embedded?: boolean
}

export const AIchatV2: React.FC<AIchatV2Props> = ({ isActive, embedded = false }) => {
  const { t } = useTranslation()
  const { mindMap } = useMindMapStore()
  const {
    models,
    selectedModel,
    setSelectedModel,
    isAIConfigured,
    isLoading: modelsLoading
  } = useModelSelector()

  // ✅ 从 runtime 读取 AI SDK 状态 (单一事实源; Provider 由 AIChatProvider 在 Canvas 顶层挂载)
  const runtime = useAIChatRuntime()
  const { messages, status } = runtime
  const isProcessing = status === 'submitted' || status === 'streaming'

  // ✅ 从 store 读取 UI 状态
  const {
    showHistory,
    setShowHistory,
    currentConversationId,
    totalTokenUsage,
    showScrollToBottom,
    setShowScrollToBottom,
    createNewConversation,
    loadConversation,
    setMergedUserPrompt,
    showSettings,
    setShowSettings
  } = useAIChatV2Store()

  // Prompts 由扩展模块提供；社区版无 prompt 命名空间, 不注入合并 prompt.
  const myPrompts: Array<{ id: string; title: string; isEnabled: boolean; content: string }> = []
  useEffect(() => {
    setMergedUserPrompt('')
  }, [setMergedUserPrompt])
  // Prompt Manager 已随扩展模块拆分，社区版按钮回调为空操作。
  const setShowPromptManager = (_next: boolean) => {}

  // ✅ 获取工具列表
  const { data: toolsData, isLoading: toolsLoading } = trpc.aiV2.getTools.useQuery<AiToolListResult>()

  // ✅ 获取 MCP 工具列表
  const { isLoading: mcpToolsLoading } = useMCPTools({ enabled: !!isActive })
  // 桌面端 stub 返回 data=undefined; 用 module-level singleton 兜底防 destructure
  // 默认值每次生成新 [] 触发 useEffect loop (Maximum update depth exceeded).
  const { data: mcpServersData } = trpc.mcp.list.useQuery<McpServerItem[]>()
  const mcpServers = mcpServersData ?? EMPTY_MCP_SERVERS
  const mcpServerStatus = useMCPStore(state => state.serverStatus)

  // ✅ 声明哪些工具弹 UI (借鉴 CopilotKit useCopilotAction({ renderAndWaitForResponse }) 设计)
  useQuestionToolUI()
  useCaseConfirmToolUI()

  // 设置弹窗内容状态 (localStorage 持久化)
  const REVIEW_SETTING_KEY = 'ai-case-review-enabled'
  const [reviewEnabled, setReviewEnabled] = useState(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem(REVIEW_SETTING_KEY) === 'true'
  })
  const [mindmapContextEnabled, setMindmapContextEnabledState] = useState(() => {
    if (typeof window === 'undefined') return true
    return getMindmapContextEnabled()
  })

  const handleReviewToggle = (enabled: boolean) => {
    setReviewEnabled(enabled)
    if (typeof window !== 'undefined') {
      localStorage.setItem(REVIEW_SETTING_KEY, String(enabled))
    }
  }

  const {
    width,
    isDragging,
    onMouseDown: handleMouseDown
  } = useResizableWidth({
    initial: 400,
    min: MIN_WIDTH,
    max: MAX_WIDTH
  })

  const handleScrollToBottom = () => {
    const messageContainer = document.querySelector('[data-message-container-v2]')
    if (messageContainer) {
      const scrollElement = messageContainer.querySelector('[data-scroll-end]')
      if (scrollElement) {
        scrollElement.scrollIntoView({ behavior: 'smooth' })
      }
    }
  }

  const handleScrollStatusChange = (isNearBottom: boolean) => {
    setShowScrollToBottom(!isNearBottom && messages.length > 0)
  }

  const handleCreateNewConversation = async () => {
    if (!(mindMap as { workspaceId?: string } | null)?.workspaceId) return
    await createNewConversation((mindMap as { workspaceId?: string } | null)!.workspaceId!)
    setShowHistory(false)
  }

  const toggleHistory = () => {
    setShowHistory(!showHistory)
  }

  const handleSelectConversation = async (conversationId: string) => {
    await loadConversation(conversationId)
    setShowHistory(false)
  }

  if (!isActive) return null

  const content = (
    <div className="flex flex-col h-full text-sm" data-ai-chat-panel>
      {!embedded && (
        <div className="relative flex items-center px-3 py-2 border-b border-border">
          <div
            className={cn(
              'flex items-center justify-center size-5 mr-2 cursor-ew-resize rounded hover:bg-muted transition-colors',
              isDragging ? 'bg-muted' : 'bg-muted/50'
            )}
            onMouseDown={handleMouseDown}
          >
            <GripVertical className="size-3 text-muted-foreground" />
          </div>
          <div className="text-sm font-medium text-foreground flex-1">Zoey V2</div>
          <div className="flex items-center gap-2">
            {/* Context Usage Indicator */}
            <ContextUsageIndicator
              usedTokens={totalTokenUsage.total}
              maxTokens={models.find(m => m.id === selectedModel)?.maxContextTokens || 128000}
            />
            <ActivePromptsIndicator
              enabledPrompts={(myPrompts ?? [])
                .filter(p => p.isEnabled)
                .map(p => ({ id: p.id, name: p.title }))}
              onClick={() => setShowPromptManager(true)}
              title={t('mindmap.aiChat.core.promptLibrary')}
            />
            <button
              type="button"
              onClick={() => setShowSettings(true)}
              className="flex items-center justify-center size-6 rounded hover:bg-muted transition-colors"
              title={t('mindmap.aiChat.input.caseReviewSettings')}
            >
              <Settings className="size-3 text-muted-foreground" />
            </button>
            <button
              type="button"
              onClick={handleCreateNewConversation}
              disabled={isProcessing}
              className={cn(
                'flex items-center justify-center size-6 rounded hover:bg-muted transition-colors',
                isProcessing && 'opacity-40 cursor-not-allowed hover:bg-transparent'
              )}
              title={
                isProcessing
                  ? t('mindmap.aiChat.core.newConversationDisabledWhileProcessing')
                  : t('mindmap.aiChat.core.newConversation')
              }
            >
              <Plus className="size-3 text-muted-foreground" />
            </button>
            <button
              type="button"
              onClick={toggleHistory}
              disabled={isProcessing}
              className={cn(
                'flex items-center justify-center size-6 rounded hover:bg-muted transition-colors',
                showHistory && 'bg-muted',
                isProcessing && 'opacity-40 cursor-not-allowed hover:bg-transparent'
              )}
              title={
                isProcessing
                  ? t('mindmap.aiChat.core.historyDisabledWhileProcessing')
                  : t('mindmap.aiChat.core.chatHistory')
              }
              data-chat-history-trigger
            >
              <History className="size-3 text-muted-foreground" />
            </button>
          </div>

          {/* 历史聊天面板 */}
          <ChatHistoryPanel
            isOpen={showHistory}
            onClose={() => setShowHistory(false)}
            workspaceId={
              (mindMap as { workspaceId?: string } | null)?.workspaceId || 'default-project'
            }
            onSelectConversation={handleSelectConversation}
            currentConversationId={currentConversationId}
          />
        </div>
      )}

      {/* Message Area */}
      <div className="flex-1 min-h-0 relative" data-message-container-v2>
        {!isAIConfigured && !modelsLoading ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground space-y-4 px-6">
            <AlertCircle className="size-12 mb-2 text-warning" />
            <div className="text-lg font-medium text-foreground">
              {t('mindmap.aiChat.core.aiNotConfigured')}
            </div>
            <div className="text-sm text-center text-muted-foreground max-w-[320px]">
              {t('mindmap.aiChat.core.notConfiguredMember')}
            </div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground space-y-4">
            <Bot className="size-12 mb-2 text-muted-foreground/70" />
            <div className="text-lg font-medium">{t('mindmap.aiChat.core.agentMode')}</div>
            <div className="text-sm text-center text-muted-foreground/70 max-w-[320px]">
              {t('mindmap.aiChat.core.agentDescription')}
              {toolsLoading || mcpToolsLoading ? (
                <div className="mt-3 text-muted-foreground/70">
                  {t('mindmap.aiChat.core.loadingTools')}
                </div>
              ) : (
                <>
                  {/* 内置工具 */}
                  {toolsData?.tools && toolsData.tools.length > 0 && (
                    <div className="mt-3">
                      <div className="text-xs text-muted-foreground/70 mb-1.5">
                        {t('mindmap.aiChat.core.builtinTools')}
                      </div>
                      <div className="flex flex-wrap justify-center gap-1.5">
                        {toolsData.tools.map(tool => (
                          <span
                            key={tool.name}
                            className="px-2 py-0.5 rounded-full text-xs bg-muted text-muted-foreground border border-border/50"
                          >
                            {tool.label}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* MCP 服务器状态（V2 面板仅展示名称 + 连接状态） */}
                  <div className="mt-3">
                    <div className="text-xs text-muted-foreground/70 mb-1.5">
                      {t('mindmap.aiChat.core.mcpConnection')}
                    </div>
                    {mcpToolsLoading ? (
                      <div className="text-muted-foreground/70 text-xs">
                        {t('mindmap.aiChat.core.detectingConnection')}
                      </div>
                    ) : mcpServers.filter(s => !s.disabled).length > 0 ? (
                      <div className="text-xs text-muted-foreground/80 flex flex-wrap justify-center gap-x-3 gap-y-1">
                        {mcpServers
                          .filter(s => !s.disabled)
                          .map(server => {
                            const connected = server.preset
                              ? true
                              : mcpServerStatus[server.id]?.connected === true
                            return (
                              <span key={server.id}>
                                {server.name}{' '}
                                {connected
                                  ? t('mindmap.aiChat.core.mcpConnected')
                                  : t('mindmap.aiChat.core.mcpDisconnected')}
                              </span>
                            )
                          })}
                      </div>
                    ) : (
                      <div className="text-muted-foreground/70 text-xs">
                        {t('mindmap.aiChat.core.noActiveMcp')}
                      </div>
                    )}
                  </div>

                  {/* 无工具提示 */}
                  {(!toolsData?.tools || toolsData.tools.length === 0) &&
                    mcpServers.filter(s => !s.disabled).length === 0 && (
                      <div className="mt-3 text-muted-foreground/70">
                        {t('mindmap.aiChat.core.noTools')}
                      </div>
                    )}
                </>
              )}
            </div>
          </div>
        ) : (
          <ErrorBoundary>
            <MindMapInstanceProvider mindMap={mindMap}>
              <MessageView
                onScrollStatusChange={handleScrollStatusChange}
                models={models}
                selectedModel={selectedModel}
                setSelectedModel={setSelectedModel}
                onOpenPromptManager={() => setShowPromptManager(true)}
              />
            </MindMapInstanceProvider>
          </ErrorBoundary>
        )}

        {/* Scroll to Bottom Button */}
        {showScrollToBottom && (
          <Button
            variant="ghost"
            size="icon"
            onClick={handleScrollToBottom}
            className="absolute bottom-4 right-4 bg-card shadow-md hover:shadow-lg transition-all duration-200 border border-border z-20 size-7"
            title={t('mindmap.aiChat.core.scrollToBottom')}
          >
            <ChevronDown className="size-3" />
          </Button>
        )}
      </div>

      {/* HITL 工具 UI 统一渲染点 (question / case-confirm panels) */}
      <div className="px-3">
        <ToolUIRenderer />
      </div>

      {/* Input Area */}
      <div>
        <InputView
          models={models}
          selectedModel={selectedModel}
          setSelectedModel={setSelectedModel}
          onOpenPromptManager={() => setShowPromptManager(true)}
          disabled={!isAIConfigured}
        />
      </div>
      {/* PromptManagerModal 已随扩展模块拆分，社区版不渲染。 */}
      <AIChatSettingsDialog
        open={showSettings}
        onOpenChange={setShowSettings}
        reviewEnabled={reviewEnabled}
        onReviewEnabledChange={handleReviewToggle}
        mindmapContextEnabled={mindmapContextEnabled}
        onMindmapContextEnabledChange={enabled => {
          setMindmapContextEnabled(enabled)
          setMindmapContextEnabledState(enabled)
        }}
      />
    </div>
  )

  if (embedded) {
    return <div className="h-full w-full bg-card">{content}</div>
  }

  return (
    <div
      className="fixed top-4 right-4 bg-card rounded-lg shadow-lg z-10 h-[calc(100vh-80px)] border border-border"
      style={{ width: `${width}px` }}
    >
      {content}
    </div>
  )
}
