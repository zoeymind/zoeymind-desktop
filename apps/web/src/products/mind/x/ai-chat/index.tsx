/**
 * AIchatV2 - 基于 Vercel AI SDK 的 AI 聊天组件
 *
 * 完全独立的实现，与旧版本并行
 * 所有状态通过 useAIChatV2Store 管理，组件间无 props 传递
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { AiToolListResult } from "../lib/api-types"
import { ChevronDown, Plus, History, Settings, X } from "lucide-react"
import {
  Badge,
  Button,
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  useTheme,
} from "@zoeymind/ui"
import { MessageView } from "./components/messageView"
import { InputView } from "./components/inputView"
import { ActivePromptsIndicator } from "./components/ActivePromptsIndicator"
import { ChatHistoryPanel } from "./components/historyView/ChatHistoryPanel"
import { LOCAL_AI_TOOLS } from "./local-tools"
import { PromptManagerModal } from "./components/PromptManager/PromptManagerModal"
import { usePromptsQuery } from "./hooks/usePrompts"
import { ErrorBoundary } from "./components/ErrorBoundary"
import { MindMapInstanceProvider } from "./context/MindMapInstanceContext"
import { ToolUIRenderer } from "./context/ToolUIRenderer"
import { restorePendingFromMessages } from "./context/ToolUIRegistry"
import { useMCPTools } from "./hooks/useMCPTools"
import { useModelSelector } from "./hooks/useModelSelector"
import { useAIChatV2Store } from "./stores/useAIChatV2Store"
import { useAIChatRuntime } from "./context/ai-chat-runtime"
import { useMCPStore } from "../useMCPStore"
import { useProjectMindMapStore as useMindMapStore } from "@/products/mind/editor-session"
import { cn } from "@/shared/app-shared"
import { useTranslation } from "@zoeymind/i18n"
import { useQuestionToolUI } from "./tools/ui-handlers/QuestionToolUI"
import { useDocumentEditApprovalToolUI } from "./tools/ui-handlers/useDocumentEditApprovalToolUI"
import { useUIStore } from "@/products/mind/stores"
import zoeyLogoLightUrl from "@/assets/logo.svg"
import zoeyLogoDarkUrl from "@/assets/logo-dark.svg"

interface AIchatV2Props {
  isActive?: boolean
}
export const AIchatV2: React.FC<AIchatV2Props> = ({ isActive }) => {
  const { t } = useTranslation()
  const { resolvedTheme } = useTheme()
  const zoeyLogoUrl = resolvedTheme === "dark" ? zoeyLogoDarkUrl : zoeyLogoLightUrl
  const { mindMap } = useMindMapStore()
  const closeAIChat = useUIStore(state => state.closeFormatTab)
  const {
    models,
    selectedModel,
    setSelectedModel,
    isAIConfigured,
    isLoading: modelsLoading,
    contextBudget,
  } = useModelSelector()

  // ✅ 从 runtime 读取 AI SDK 状态 (单一事实源; Provider 由 AIChatProvider 在 Canvas 顶层挂载)
  const runtime = useAIChatRuntime()
  const { messages, status } = runtime
  const isProcessing = status === "submitted" || status === "streaming"

  // ✅ 从 store 读取 UI 状态 — 每个字段单独 selector.
  // 整仓 useAIChatV2Store() 会让每次 inputMessage 击键都重渲染整个面板树.
  const showHistory = useAIChatV2Store(s => s.showHistory)
  const setShowHistory = useAIChatV2Store(s => s.setShowHistory)
  const currentConversationId = useAIChatV2Store(s => s.currentConversationId)
  const totalTokenUsage = useAIChatV2Store(s => s.totalTokenUsage)
  const showScrollToBottom = useAIChatV2Store(s => s.showScrollToBottom)
  const setShowScrollToBottom = useAIChatV2Store(s => s.setShowScrollToBottom)
  const createNewConversation = useAIChatV2Store(s => s.createNewConversation)
  const loadConversation = useAIChatV2Store(s => s.loadConversation)
  const setMergedUserPrompt = useAIChatV2Store(s => s.setMergedUserPrompt)
  // 本地提示词库 (sqlite prompts 表). 启用的指令拼进 mergedUserPrompt,
  // 作为 system prompt 前置发给模型.
  const { data: myPromptsData } = usePromptsQuery()
  const myPrompts = useMemo(() => myPromptsData ?? [], [myPromptsData])
  useEffect(() => {
    setMergedUserPrompt(
      myPrompts
        .filter(p => p.isEnabled)
        .map(p => p.content)
        .join("\n\n")
    )
  }, [myPrompts, setMergedUserPrompt])

  const [showPromptManager, setShowPromptManager] = useState(false)
  const handleOpenPromptManager = useCallback(() => setShowPromptManager(true), [])

  // 桌面端后端不跑 trpc.aiV2.getTools, 用本地静态清单 shim.
  const toolsData = useMemo<AiToolListResult>(() => ({ tools: LOCAL_AI_TOOLS }), [])
  const toolsLoading = false

  const { servers: mcpServers, isLoading: mcpToolsLoading } = useMCPTools()
  const mcpServerStatus = useMCPStore(state => state.serverStatus)

  useQuestionToolUI()
  useDocumentEditApprovalToolUI()

  useEffect(() => {
    if (status === "streaming" || status === "submitted") return
    restorePendingFromMessages(messages)
  }, [messages, status])

  const handleScrollToBottom = () => {
    const messageContainer = document.querySelector("[data-message-container-v2]")
    if (messageContainer) {
      const scrollElement = messageContainer.querySelector("[data-scroll-end]")
      if (scrollElement) {
        scrollElement.scrollIntoView({ behavior: "smooth" })
      }
    }
  }

  // 稳定引用: 该回调透传到 MessageScroller 的 onFollowChange, 每次 render 换新引用
  // 会级联重建其内部 useCallback/observer 链. messages 走 ref 读取避免依赖.
  const hasMessagesRef = useRef(false)
  useEffect(() => {
    hasMessagesRef.current = messages.length > 0
  }, [messages])
  const handleScrollStatusChange = useCallback(
    (isNearBottom: boolean) => {
      setShowScrollToBottom(!isNearBottom && hasMessagesRef.current)
    },
    [setShowScrollToBottom]
  )

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
      <div className="relative flex h-12 shrink-0 items-center px-3">
        <div className="flex-1" />
        <div className="flex h-full items-center gap-1">
          <ActivePromptsIndicator
            enabledPrompts={(myPrompts ?? [])
              .filter(p => p.isEnabled)
              .map(p => ({ id: p.id, name: p.title }))}
            onClick={handleOpenPromptManager}
            title={t("mindmap.aiChat.core.promptLibrary")}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleCreateNewConversation}
            disabled={isProcessing}
            className={cn(
              "rounded-full",
              isProcessing && "cursor-not-allowed hover:bg-transparent"
            )}
            title={
              isProcessing
                ? t("mindmap.aiChat.core.newConversationDisabledWhileProcessing")
                : t("mindmap.aiChat.core.newConversation")
            }
          >
            <Plus className="size-4 text-muted-foreground" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={toggleHistory}
            disabled={isProcessing}
            className={cn(
              "rounded-full",
              showHistory && "bg-muted",
              isProcessing && "cursor-not-allowed hover:bg-transparent"
            )}
            title={
              isProcessing
                ? t("mindmap.aiChat.core.historyDisabledWhileProcessing")
                : t("mindmap.aiChat.core.chatHistory")
            }
            data-chat-history-trigger
          >
            <History className="size-4 text-muted-foreground" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={closeAIChat}
            aria-label={t("common.close")}
            title={t("common.close")}
            className="rounded-full text-muted-foreground hover:text-foreground"
          >
            <X className="size-4" />
          </Button>
        </div>

        {/* 历史聊天面板 */}
        <ChatHistoryPanel
          isOpen={showHistory}
          onClose={() => setShowHistory(false)}
          workspaceId={
            (mindMap as { workspaceId?: string } | null)?.workspaceId || "default-project"
          }
          onSelectConversation={handleSelectConversation}
          currentConversationId={currentConversationId}
        />
      </div>

      {/* Message Area */}
      <div className="flex-1 min-h-0 relative" data-message-container-v2>
        {!isAIConfigured && !modelsLoading ? (
          <Empty className="h-full rounded-none border-0 px-6">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Settings />
              </EmptyMedia>
              <EmptyTitle>{t("mindmap.aiChat.core.aiNotConfigured")}</EmptyTitle>
              <EmptyDescription className="max-w-[320px]">
                {t("mindmap.aiChat.core.notConfiguredOpenTitlebarSettings")}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : messages.length === 0 ? (
          <Empty className="h-full rounded-none border-0">
            <EmptyHeader>
              <EmptyMedia className="mb-1 size-16 rounded-2xl bg-muted/50 shadow-sm ring-1 ring-foreground/10 dark:ring-white/10">
                <img
                  src={zoeyLogoUrl}
                  alt=""
                  aria-hidden="true"
                  className="size-10 object-contain"
                />
              </EmptyMedia>
              <EmptyTitle className="text-lg text-foreground">
                {t("mindmap.aiChat.core.agentMode")}
              </EmptyTitle>
              <EmptyDescription className="max-w-[320px]">
                {t("mindmap.aiChat.core.agentDescription")}
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              {toolsLoading || mcpToolsLoading ? (
                <EmptyDescription>{t("mindmap.aiChat.core.loadingTools")}</EmptyDescription>
              ) : (
                <>
                  {toolsData?.tools && toolsData.tools.length > 0 && (
                    <EmptyContent className="gap-1.5">
                      <EmptyDescription>{t("mindmap.aiChat.core.builtinTools")}</EmptyDescription>
                      <div className="flex flex-wrap justify-center gap-1.5">
                        {toolsData.tools.map(tool => (
                          <Badge
                            key={tool.name}
                            variant="secondary"
                            className="rounded-full font-normal"
                          >
                            {tool.label}
                          </Badge>
                        ))}
                      </div>
                    </EmptyContent>
                  )}
                  <EmptyContent className="gap-1.5">
                    <EmptyDescription>{t("mindmap.aiChat.core.mcpConnection")}</EmptyDescription>
                    {mcpToolsLoading ? (
                      <EmptyDescription>
                        {t("mindmap.aiChat.core.detectingConnection")}
                      </EmptyDescription>
                    ) : mcpServers.filter(server => server.disabled !== true).length > 0 ? (
                      <div className="flex flex-wrap justify-center gap-1.5">
                        {mcpServers
                          .filter(server => server.disabled !== true)
                          .map(server => {
                            const connected = mcpServerStatus[server.id]?.connected === true
                            return (
                              <Badge
                                key={server.id}
                                variant="outline"
                                className="rounded-full font-normal"
                              >
                                {server.name} ·{" "}
                                {connected
                                  ? t("mindmap.aiChat.core.mcpConnected")
                                  : t("mindmap.aiChat.core.mcpDisconnected")}
                              </Badge>
                            )
                          })}
                      </div>
                    ) : (
                      <EmptyDescription>{t("mindmap.aiChat.core.noActiveMcp")}</EmptyDescription>
                    )}
                  </EmptyContent>
                  {(!toolsData?.tools || toolsData.tools.length === 0) &&
                    mcpServers.filter(server => !server.disabled).length === 0 && (
                      <EmptyDescription>{t("mindmap.aiChat.core.noTools")}</EmptyDescription>
                    )}
                </>
              )}
            </EmptyContent>
          </Empty>
        ) : (
          <ErrorBoundary>
            <MindMapInstanceProvider mindMap={mindMap}>
              <MessageView
                onScrollStatusChange={handleScrollStatusChange}
                models={models}
                selectedModel={selectedModel}
                setSelectedModel={setSelectedModel}
                maxTokens={contextBudget?.contextWindow ?? 128000}
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
            title={t("mindmap.aiChat.core.scrollToBottom")}
          >
            <ChevronDown className="size-3" />
          </Button>
        )}
      </div>

      {/* HITL 工具 UI 在正常文档流中，始终位于输入框上方。 */}
      <div className="shrink-0 px-3">
        <ToolUIRenderer />
      </div>

      {/* Input Area */}
      <div>
        <InputView
          models={models}
          selectedModel={selectedModel}
          setSelectedModel={setSelectedModel}
          disabled={!isAIConfigured}
          usedTokens={totalTokenUsage.total}
          maxTokens={contextBudget?.contextWindow ?? 128000}
        />
      </div>
      <PromptManagerModal isOpen={showPromptManager} onClose={() => setShowPromptManager(false)} />
    </div>
  )

  return <div className="h-full w-full">{content}</div>
}
