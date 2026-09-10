/**
 * AIchatV2 专用 Zustand Store
 *
 * 管理所有聊天状态，避免 props drilling
 */

import { create } from "zustand"
import { logger } from "@zoeymind/logger"
import type { Attachment, SendMessageParams, TokenUsage } from "../../ai-chat/types"
import { sqliteChatStore } from "../storage/sqliteChatStore"
import type { CompactionState, Conversation } from "../storage/sqliteChatStore"
import { getModuleAIChatRuntime } from "../../ai-chat/context/ai-chat-runtime"
import { useTabs } from "@/shared/tabs/store"
import { useCompactionStore } from "../../ai-chat/compaction/useCompactionStore"
import { resetToolUI, restorePendingFromMessages } from "../../ai-chat/context/ToolUIRegistry"
import {
  interruptPendingToolParts,
  pendingToolCallIds,
  TOOL_EXECUTION_INTERRUPTED,
} from "../../ai-chat/utils/pendingToolCalls"

interface MessageDraftPayload {
  text: string
  attachments: Attachment[]
}

const buildSendMessageParams = ({
  text,
  attachments,
  selectedModel,
  provider,
  conversationId,
}: MessageDraftPayload & {
  selectedModel: string
  provider?: string
  conversationId?: string
}): SendMessageParams => {
  const filesParts = attachments
    .filter(attachment => attachment.type === "image" && attachment.dataUrl)
    .map(attachment => ({
      type: "file" as const,
      filename: attachment.name || "image.png",
      mediaType: "image/png",
      url: attachment.dataUrl,
    }))

  return {
    text,
    files: filesParts.length > 0 ? filesParts : undefined,
    metadata: {
      model: selectedModel,
      turnStartedAt: Date.now(),
      ...(provider && { provider }),
      ...(conversationId && { conversationId }),
    },
  }
}
const activeResends = new Set<string>()
const conversationTransitions = new Map<string, number>()
let conversationRequest = 0

function nextConversationTransition(workspaceId: string): number {
  const transition = ++conversationRequest
  conversationTransitions.set(workspaceId, transition)
  return transition
}

function claimConversationTransition(workspaceId: string, transition: number): boolean {
  const current = conversationTransitions.get(workspaceId) ?? 0
  if (current > transition) return false
  conversationTransitions.set(workspaceId, transition)
  return true
}

function isCurrentConversationTransition(workspaceId: string, transition: number): boolean {
  return conversationTransitions.get(workspaceId) === transition
}

function isActiveWorkspace(workspaceId: string): boolean {
  return useTabs.getState().activeId === workspaceId
}

interface AIchatV2State {
  // 核心状态 (messages 已移到 runtime context, 不在 store)
  currentConversationId: string | undefined
  conversationIdsByWorkspace: Record<string, string | undefined>
  knowledgeBaseIdsByWorkspace: Record<string, string[] | undefined>
  compactionsByWorkspace: Record<string, CompactionState | null | undefined>
  totalTokenUsage: TokenUsage

  // 输入框状态
  inputMessage: string
  attachments: Attachment[]

  // 历史面板状态
  showHistory: boolean
  conversations: Conversation[]

  // UI 状态
  showScrollToBottom: boolean

  // RAG 知识库选择状态
  selectedKnowledgeBaseIds: string[]

  // 异常/中断状态
  abortedMessageId: string | null
  interruptedToolCallIds: string[]
  lastSentInput: string

  // 用户 prompt (来自 trpc)
  mergedUserPrompt: string
  // Actions
  setCurrentConversationId: (id: string | undefined) => void
  selectWorkspaceConversation: (workspaceId: string) => void
  setTotalTokenUsage: (usage: TokenUsage) => void
  setInputMessage: (message: string) => void
  setAttachments: (attachments: Attachment[] | ((prev: Attachment[]) => Attachment[])) => void
  setShowHistory: (show: boolean) => void
  setConversations: (conversations: Conversation[]) => void
  setShowScrollToBottom: (show: boolean) => void
  setSelectedKnowledgeBaseIds: (ids: string[]) => void
  setMergedUserPrompt: (prompt: string) => void
  restoreInput: () => void

  // 业务 Actions
  sendMessage: (workspaceId: string, selectedModel: string, provider?: string) => Promise<void>
  interruptAndSend: (workspaceId: string, selectedModel: string, provider?: string) => Promise<void>
  stopGeneration: (workspaceId: string) => Promise<void>
  resendMessageFrom: (
    messageId: string,
    draft: MessageDraftPayload,
    workspaceId: string,
    selectedModel: string,
    provider?: string
  ) => Promise<boolean>
  createNewConversation: (workspaceId: string) => Promise<void>
  loadConversation: (conversationId: string) => Promise<void>
  loadConversations: (workspaceId: string) => Promise<void>
  deleteConversation: (conversationId: string, workspaceId: string) => Promise<void>
  clearInput: () => void
}

export const useAIChatV2Store = create<AIchatV2State>((set, get) => ({
  currentConversationId: undefined,
  conversationIdsByWorkspace: {},
  knowledgeBaseIdsByWorkspace: {},
  compactionsByWorkspace: {},
  totalTokenUsage: { input: 0, output: 0, total: 0 },
  inputMessage: "",
  attachments: [],
  showHistory: false,
  conversations: [],
  showScrollToBottom: false,
  selectedKnowledgeBaseIds: [],
  abortedMessageId: null,
  interruptedToolCallIds: [],
  lastSentInput: "",
  mergedUserPrompt: "",

  // Setters（添加值比较以避免无限循环）
  setCurrentConversationId: id => {
    const current = get()
    if (current.currentConversationId !== id) {
      set({ currentConversationId: id })
    }
  },
  selectWorkspaceConversation: workspaceId => {
    const current = get()
    const conversationId = current.conversationIdsByWorkspace[workspaceId]
    if (!conversationId || current.currentConversationId === conversationId) return
    set({
      currentConversationId: conversationId,
      selectedKnowledgeBaseIds: current.knowledgeBaseIdsByWorkspace[workspaceId] ?? [],
      abortedMessageId: null,
      interruptedToolCallIds: [],
    })
    useCompactionStore.getState().setCompaction(current.compactionsByWorkspace[workspaceId] ?? null)
  },
  setTotalTokenUsage: usage => {
    const current = get()
    // 只在 total 值变化时更新（避免对象引用变化）
    if (current.totalTokenUsage.total !== usage.total) {
      set({ totalTokenUsage: usage })
    }
  },
  setInputMessage: message => {
    const current = get()
    if (current.inputMessage !== message) {
      set({ inputMessage: message })
    }
  },
  setAttachments: attachmentsOrUpdater => {
    const current = get()
    const newAttachments =
      typeof attachmentsOrUpdater === "function"
        ? attachmentsOrUpdater(current.attachments)
        : attachmentsOrUpdater
    if (current.attachments !== newAttachments) {
      set({ attachments: newAttachments })
    }
  },
  setShowHistory: show => {
    const current = get()
    if (current.showHistory !== show) {
      set({ showHistory: show })
    }
  },
  setConversations: conversations => {
    const current = get()
    if (current.conversations !== conversations) {
      set({ conversations })
    }
  },
  setShowScrollToBottom: show => {
    const current = get()
    if (current.showScrollToBottom !== show) {
      set({ showScrollToBottom: show })
    }
  },
  setMergedUserPrompt: prompt => {
    const current = get()
    if (current.mergedUserPrompt !== prompt) {
      set({ mergedUserPrompt: prompt })
    }
  },
  setSelectedKnowledgeBaseIds: async ids => {
    const current = get()
    const currentIds = current.selectedKnowledgeBaseIds
    const idsEqual =
      currentIds.length === ids.length && currentIds.every((id, index) => id === ids[index])
    if (idsEqual) return

    const workspaceId = useTabs.getState().activeId
    const conversationId =
      workspaceId === "home" ? undefined : current.conversationIdsByWorkspace[workspaceId]
    set({
      selectedKnowledgeBaseIds: ids,
      knowledgeBaseIdsByWorkspace:
        workspaceId === "home"
          ? current.knowledgeBaseIdsByWorkspace
          : { ...current.knowledgeBaseIdsByWorkspace, [workspaceId]: ids },
    })

    if (conversationId) {
      try {
        await sqliteChatStore.updateConversation(conversationId, {
          selectedKnowledgeBaseIds: ids.length > 0 ? ids : undefined,
        })
      } catch (error) {
        logger.error("[AIchatV2Store] 保存知识库选择失败", { error })
      }
    }
  },

  restoreInput: () => {
    const { lastSentInput } = get()
    if (lastSentInput) {
      set({ inputMessage: lastSentInput, lastSentInput: "" })
    }
  },

  // 发送消息
  sendMessage: async (workspaceId, selectedModel, provider) => {
    const { inputMessage, attachments, conversationIdsByWorkspace, selectedKnowledgeBaseIds } =
      get()
    const currentConversationId = conversationIdsByWorkspace[workspaceId]
    const runtime = getModuleAIChatRuntime(workspaceId)

    if ((!inputMessage.trim() && attachments.length === 0) || !runtime) {
      logger.warn("[AIchatV2Store] 无法发送消息", {
        inputEmpty: !inputMessage.trim(),
        attachmentsCount: attachments.length,
        runtimeReady: !!runtime,
        workspaceId,
        selectedModel,
      })
      return
    }
    // 暂存输入用于发送失败时恢复；清除中断标记
    set({
      lastSentInput: inputMessage,
      abortedMessageId: null,
      interruptedToolCallIds: [],
    })

    const messages = runtime.messages
    const cleanedMessages = (() => {
      if (messages.length === 0) return messages
      const lastIndex = messages.length - 1
      const lastMessage = messages[lastIndex]
      if (lastMessage.role !== "assistant") return messages
      const nextParts = (lastMessage.parts || []).filter(part => {
        // 检查是否为错误类型的 part
        const partWithError = part as { type?: string; errorText?: string }
        return partWithError.type !== "error" && !partWithError.errorText
      })
      if (nextParts.length === 0) {
        return messages.slice(0, -1)
      }
      if (nextParts.length !== (lastMessage.parts || []).length) {
        return [...messages.slice(0, -1), { ...lastMessage, parts: nextParts }]
      }
      return messages
    })()

    if (cleanedMessages !== messages) {
      runtime.setMessages(cleanedMessages)
    }

    try {
      // 如果没有当前对话，先创建一个
      let conversationId = currentConversationId
      if (!conversationId) {
        await get().createNewConversation(workspaceId)
        conversationId = get().conversationIdsByWorkspace[workspaceId]
        if (conversationId && selectedKnowledgeBaseIds.length > 0) {
          await sqliteChatStore.updateConversation(conversationId, {
            selectedKnowledgeBaseIds,
          })
        }
      }

      const sendParams = buildSendMessageParams({
        text: inputMessage,
        conversationId,
        attachments,
        selectedModel,
        provider,
      })
      const sending = runtime.sendMessage(sendParams)
      if (
        get().conversationIdsByWorkspace[workspaceId] === conversationId &&
        get().inputMessage === inputMessage &&
        get().attachments === attachments
      ) {
        get().clearInput()
      }
      await sending
    } catch (error) {
      if (
        get().conversationIdsByWorkspace[workspaceId] === currentConversationId &&
        !get().inputMessage
      ) {
        set({ inputMessage, attachments, lastSentInput: "" })
      }
      logger.error("[AIchatV2Store] 发送消息失败", { error })
      throw error
    }
  },

  // 停止生成
  // 注: 虽然后端现在透传 abortSignal, 但 useChat 在 stop() 后不会自动把 in-flight 的
  // tool part (input-streaming / input-available) 转成 output-error, 我们需要手动清理,
  // 否则下一轮 SDK 会以为还有 pending tool 拒绝发送.
  stopGeneration: async workspaceId => {
    const runtime = getModuleAIChatRuntime(workspaceId)
    const stopping = runtime?.stop() ?? Promise.resolve()
    resetToolUI()
    const messages = runtime?.messages ?? []

    const lastMsg = messages.length > 0 ? messages[messages.length - 1] : null
    if (lastMsg?.role === "assistant") {
      set({
        abortedMessageId: lastMsg.id,
        interruptedToolCallIds: pendingToolCallIds(lastMsg),
      })

      const interruptedMessage = interruptPendingToolParts(lastMsg, TOOL_EXECUTION_INTERRUPTED)
      if (runtime) runtime.setMessages([...messages.slice(0, -1), interruptedMessage])
    } else if (runtime) {
      runtime.setMessages(messages)
    }
    await stopping
  },

  interruptAndSend: async (workspaceId, selectedModel, provider) => {
    const runtime = getModuleAIChatRuntime(workspaceId)
    if (!runtime || runtime.status === "ready") {
      await get().sendMessage(workspaceId, selectedModel, provider)
      return
    }

    const { inputMessage, attachments, conversationIdsByWorkspace } = get()
    const conversationId = conversationIdsByWorkspace[workspaceId]
    await get().stopGeneration(workspaceId)

    if (
      getModuleAIChatRuntime(workspaceId)?.instanceId !== runtime.instanceId ||
      get().conversationIdsByWorkspace[workspaceId] !== conversationId
    )
      return

    const sending = runtime.sendMessage(
      buildSendMessageParams({
        text: inputMessage,
        attachments,
        selectedModel,
        provider,
        conversationId,
      })
    )
    if (get().inputMessage === inputMessage && get().attachments === attachments) get().clearInput()
    try {
      await sending
    } catch (error) {
      if (get().conversationIdsByWorkspace[workspaceId] === conversationId && !get().inputMessage)
        set({ inputMessage, attachments })
      throw error
    }
  },

  // 从指定用户消息之前的上下文重新发送：仅重放该消息之前的对话，不污染底部输入框。
  resendMessageFrom: async (messageId, draft, workspaceId, selectedModel, provider) => {
    const { conversationIdsByWorkspace, selectedKnowledgeBaseIds } = get()
    const currentConversationId = conversationIdsByWorkspace[workspaceId]
    const runtime = getModuleAIChatRuntime(workspaceId)

    if ((!draft.text.trim() && draft.attachments.length === 0) || !runtime) {
      logger.warn("[AIchatV2Store] 无法重新发送消息：输入为空或 runtime 未初始化", {
        messageId,
      })
      return false
    }

    const resendKey = `${currentConversationId ?? "new"}:${messageId}`
    if (activeResends.has(resendKey)) return false
    activeResends.add(resendKey)

    try {
      let conversationId = currentConversationId
      let messages = runtime.messages
      let messageIndex = messages.findIndex(message => message.id === messageId)

      if (messageIndex === -1 && conversationId) {
        const persisted = await sqliteChatStore.loadConversationState(conversationId)
        messages = persisted.transcript
        messageIndex = messages.findIndex(message => message.id === messageId)
      }
      if (messageIndex === -1) {
        logger.warn("[AIchatV2Store] 未找到要重新发送的消息", {
          messageId,
          conversationId,
        })
        return false
      }

      set({
        lastSentInput: draft.text,
        abortedMessageId: null,
        interruptedToolCallIds: [],
      })

      if (!conversationId) {
        await get().createNewConversation(workspaceId)
        conversationId = get().conversationIdsByWorkspace[workspaceId]
        if (conversationId && selectedKnowledgeBaseIds.length > 0) {
          await sqliteChatStore.updateConversation(conversationId, {
            selectedKnowledgeBaseIds,
          })
        }
      }

      const baseMessages = messages.slice(0, messageIndex)
      runtime.setMessages(baseMessages)

      if (conversationId) {
        await sqliteChatStore.truncateConversation(conversationId, baseMessages)
        const loaded = await sqliteChatStore.loadConversationState(conversationId)
        useCompactionStore.getState().setCompaction(loaded.compaction)
      }

      await runtime.sendMessage(
        buildSendMessageParams({
          text: draft.text,
          attachments: draft.attachments,
          selectedModel,
          provider,
          conversationId,
        })
      )

      logger.info("[AIchatV2Store] 已从用户消息重新发送", {
        messageId,
        contentLength: draft.text.length,
        attachmentsCount: draft.attachments.length,
      })
      return true
    } catch (error) {
      logger.error("[AIchatV2Store] 重新发送消息失败", { error, messageId })
      throw error
    } finally {
      activeResends.delete(resendKey)
    }
  },

  // 创建新对话
  createNewConversation: async workspaceId => {
    const transition = nextConversationTransition(workspaceId)
    try {
      const runtime = getModuleAIChatRuntime(workspaceId)
      await runtime?.stop()
      const newConv = await sqliteChatStore.createConversation(workspaceId)
      if (!isCurrentConversationTransition(workspaceId, transition)) return
      const active = isActiveWorkspace(workspaceId)
      const current = get()
      set({
        conversationIdsByWorkspace: {
          ...current.conversationIdsByWorkspace,
          [workspaceId]: newConv.id,
        },
        knowledgeBaseIdsByWorkspace: {
          ...current.knowledgeBaseIdsByWorkspace,
          [workspaceId]: [],
        },
        compactionsByWorkspace: {
          ...current.compactionsByWorkspace,
          [workspaceId]: null,
        },
        ...(active
          ? {
              currentConversationId: newConv.id,
              inputMessage: "",
              attachments: [],
              selectedKnowledgeBaseIds: [],
              abortedMessageId: null,
              interruptedToolCallIds: [],
            }
          : {}),
      })
      if (active) useCompactionStore.getState().reset()
      runtime?.setMessages([])

      logger.info("[AIchatV2Store] 创建新对话", { conversationId: newConv.id })
    } catch (error) {
      logger.error("[AIchatV2Store] 创建新对话失败", { error })
    }
  },

  // 加载对话
  loadConversation: async conversationId => {
    const transition = ++conversationRequest
    try {
      const conversation = await sqliteChatStore.getConversation(conversationId)
      if (!conversation) return
      const { workspaceId } = conversation
      if (!claimConversationTransition(workspaceId, transition)) return
      const { transcript, compaction } = await sqliteChatStore.loadConversationState(conversationId)
      const runtime = getModuleAIChatRuntime(workspaceId)
      await runtime?.stop()
      if (!isCurrentConversationTransition(workspaceId, transition)) return

      const knowledgeBaseIds =
        conversation.selectedKnowledgeBaseIds || conversation.selectedRAGDataSources || []
      const active = isActiveWorkspace(workspaceId)
      const current = get()
      set({
        conversationIdsByWorkspace: {
          ...current.conversationIdsByWorkspace,
          [workspaceId]: conversationId,
        },
        knowledgeBaseIdsByWorkspace: {
          ...current.knowledgeBaseIdsByWorkspace,
          [workspaceId]: knowledgeBaseIds,
        },
        compactionsByWorkspace: {
          ...current.compactionsByWorkspace,
          [workspaceId]: compaction,
        },
        ...(active
          ? {
              currentConversationId: conversationId,
              selectedKnowledgeBaseIds: knowledgeBaseIds,
              abortedMessageId: null,
              interruptedToolCallIds: [],
            }
          : {}),
      })

      runtime?.setMessages(transcript)
      if (active) {
        useCompactionStore.getState().setCompaction(compaction)
        restorePendingFromMessages(transcript)
      }

      logger.info("[AIchatV2Store] 加载对话", {
        conversationId,
        messageCount: transcript.length,
        knowledgeBaseCount: conversation.selectedKnowledgeBaseIds?.length || 0,
      })
    } catch (error) {
      logger.error("[AIchatV2Store] 加载对话失败", { error })
    }
  },

  // 加载所有对话
  loadConversations: async workspaceId => {
    try {
      const convs = await sqliteChatStore.getConversations(workspaceId)
      // 获取每条对话的消息数量
      const convsWithCounts = await Promise.all(
        convs.map(async conv => {
          const messages = await sqliteChatStore.loadMessages(conv.id)
          return { ...conv, messageCount: messages.length }
        })
      )
      set({ conversations: convsWithCounts })
    } catch (error) {
      logger.error("[AIchatV2Store] 加载对话列表失败", { error })
    }
  },

  // 删除对话
  deleteConversation: async (conversationId, workspaceId) => {
    try {
      await sqliteChatStore.deleteConversation(conversationId)

      // 重新加载对话列表
      await get().loadConversations(workspaceId)

      // 如果删除的是当前对话，创建新对话
      if (get().currentConversationId === conversationId) {
        await get().createNewConversation(workspaceId)
      }

      logger.info("[AIchatV2Store] 删除对话", { conversationId })
    } catch (error) {
      logger.error("[AIchatV2Store] 删除对话失败", { error })
    }
  },

  // 清空输入
  clearInput: () => {
    set({
      inputMessage: "",
      attachments: [],
    })
  },

  // 用例确认 / Simple question: 已经搬到 ToolUIRegistry + tools/ui-handlers/*ToolUI.tsx,
  // store 不再持这些 UI state.
}))
