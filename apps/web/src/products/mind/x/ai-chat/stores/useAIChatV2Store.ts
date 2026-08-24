/**
 * AIchatV2 专用 Zustand Store
 *
 * 管理所有聊天状态，避免 props drilling
 */

import { create } from "zustand"
import { logger } from "@zoeymind/logger"
import type { Attachment, SendMessageParams, TokenUsage } from "../../ai-chat/types"
import { chatDB } from "../../ai-chat/storage/chatDB"
import type { Conversation } from "../../ai-chat/storage/chatDB"
import { getModuleAIChatRuntime } from "../../ai-chat/context/ai-chat-runtime"
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
}: MessageDraftPayload & {
  selectedModel: string
  provider?: string
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
    },
  }
}
const activeResends = new Set<string>()

interface AIchatV2State {
  // 核心状态 (messages 已移到 runtime context, 不在 store)
  currentConversationId: string | undefined
  totalTokenUsage: TokenUsage

  // 输入框状态
  inputMessage: string
  attachments: Attachment[]

  // 历史面板状态
  showHistory: boolean
  conversations: Conversation[]

  // UI 状态
  showScrollToBottom: boolean

  // 设置弹窗状态
  showSettings: boolean

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
  setTotalTokenUsage: (usage: TokenUsage) => void
  setInputMessage: (message: string) => void
  setAttachments: (attachments: Attachment[] | ((prev: Attachment[]) => Attachment[])) => void
  setShowHistory: (show: boolean) => void
  setConversations: (conversations: Conversation[]) => void
  setShowScrollToBottom: (show: boolean) => void
  setShowSettings: (show: boolean) => void
  setSelectedKnowledgeBaseIds: (ids: string[]) => void
  setMergedUserPrompt: (prompt: string) => void
  restoreInput: () => void

  // 业务 Actions
  sendMessage: (workspaceId: string, selectedModel: string, provider?: string) => Promise<void>
  interruptAndSend: (workspaceId: string, selectedModel: string, provider?: string) => Promise<void>
  stopGeneration: () => void
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
  totalTokenUsage: { input: 0, output: 0, total: 0 },
  inputMessage: "",
  attachments: [],
  showHistory: false,
  conversations: [],
  showScrollToBottom: false,
  showSettings: false,
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
  setShowSettings: show => {
    const current = get()
    if (current.showSettings !== show) {
      set({ showSettings: show })
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
    // 比较数组内容是否相同
    const currentIds = current.selectedKnowledgeBaseIds
    const idsEqual =
      currentIds.length === ids.length && currentIds.every((id, index) => id === ids[index])
    if (!idsEqual) {
      set({ selectedKnowledgeBaseIds: ids })

      // 保存到当前会话
      if (current.currentConversationId) {
        try {
          await chatDB.updateConversation(current.currentConversationId, {
            selectedKnowledgeBaseIds: ids.length > 0 ? ids : undefined,
          })
        } catch (error) {
          logger.error("[AIchatV2Store] 保存知识库选择失败", { error })
        }
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
    const { inputMessage, attachments, currentConversationId, selectedKnowledgeBaseIds } = get()
    const runtime = getModuleAIChatRuntime()

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
        conversationId = get().currentConversationId
        // 创建新会话后，保存当前的知识库选择
        if (conversationId && selectedKnowledgeBaseIds.length > 0) {
          await chatDB.updateConversation(conversationId, {
            selectedKnowledgeBaseIds,
          })
        }
      }

      const sendParams = buildSendMessageParams({
        text: inputMessage,
        attachments,
        selectedModel,
        provider,
      })

      runtime.sendMessage(sendParams)

      // 清空输入
      get().clearInput()
    } catch (error) {
      logger.error("[AIchatV2Store] 发送消息失败", { error })
    }
  },

  // 停止生成
  // 注: 虽然后端现在透传 abortSignal, 但 useChat 在 stop() 后不会自动把 in-flight 的
  // tool part (input-streaming / input-available) 转成 output-error, 我们需要手动清理,
  // 否则下一轮 SDK 会以为还有 pending tool 拒绝发送.
  stopGeneration: () => {
    const runtime = getModuleAIChatRuntime()
    runtime?.stop()
    resetToolUI()
    const messages = runtime?.messages ?? []

    const lastMsg = messages.length > 0 ? messages[messages.length - 1] : null
    if (lastMsg?.role === "assistant") {
      set({
        abortedMessageId: lastMsg.id,
        interruptedToolCallIds: pendingToolCallIds(lastMsg),
      })

      const interruptedMessage = interruptPendingToolParts(lastMsg, TOOL_EXECUTION_INTERRUPTED)
      if (interruptedMessage !== lastMsg && runtime) {
        runtime.setMessages([...messages.slice(0, -1), interruptedMessage])
      }
    }
  },

  interruptAndSend: async (workspaceId, selectedModel, provider) => {
    const runtime = getModuleAIChatRuntime()
    if (!runtime || runtime.status === "ready") {
      await get().sendMessage(workspaceId, selectedModel, provider)
      return
    }

    get().stopGeneration()

    // 等待 SDK 状态脱离 streaming/submitted（最多 500ms，每 50ms 检查）
    const MAX_WAIT = 500
    const INTERVAL = 50
    let waited = 0
    while (waited < MAX_WAIT) {
      const s = runtime.status
      if (s !== "streaming" && s !== "submitted") break
      await new Promise(r => setTimeout(r, INTERVAL))
      waited += INTERVAL
    }

    if (waited >= MAX_WAIT) {
      logger.warn("[AIchatV2Store] interruptAndSend: 等待 stop 超时，强制发送")
    }

    await get().sendMessage(workspaceId, selectedModel, provider)
  },

  // 从指定用户消息之前的上下文重新发送：仅重放该消息之前的对话，不污染底部输入框。
  resendMessageFrom: async (messageId, draft, workspaceId, selectedModel, provider) => {
    const { currentConversationId, selectedKnowledgeBaseIds } = get()
    const runtime = getModuleAIChatRuntime()

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
        const persisted = await chatDB.loadConversationState(conversationId)
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
        conversationId = get().currentConversationId
        if (conversationId && selectedKnowledgeBaseIds.length > 0) {
          await chatDB.updateConversation(conversationId, {
            selectedKnowledgeBaseIds,
          })
        }
      }

      const baseMessages = messages.slice(0, messageIndex)
      runtime.setMessages(baseMessages)

      if (conversationId) {
        await chatDB.truncateConversation(conversationId, baseMessages)
        const loaded = await chatDB.loadConversationState(conversationId)
        useCompactionStore.getState().setCompaction(loaded.compaction)
      }

      runtime.sendMessage(
        buildSendMessageParams({
          text: draft.text,
          attachments: draft.attachments,
          selectedModel,
          provider,
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
      return false
    } finally {
      activeResends.delete(resendKey)
    }
  },

  // 创建新对话
  createNewConversation: async workspaceId => {
    try {
      const newConv = await chatDB.createConversation(workspaceId)
      useCompactionStore.getState().reset()
      set({
        currentConversationId: newConv.id,
        inputMessage: "",
        attachments: [],
        selectedKnowledgeBaseIds: [], // 新会话清空知识库选择
      })

      // 同步到 SDK
      getModuleAIChatRuntime()?.setMessages([])

      logger.info("[AIchatV2Store] 创建新对话", { conversationId: newConv.id })
    } catch (error) {
      logger.error("[AIchatV2Store] 创建新对话失败", { error })
    }
  },

  // 加载对话
  loadConversation: async conversationId => {
    try {
      const { transcript, compaction } = await chatDB.loadConversationState(conversationId)
      const conversation = await chatDB.getConversation(conversationId)

      const knowledgeBaseIds =
        conversation?.selectedKnowledgeBaseIds || conversation?.selectedRAGDataSources || []

      set({
        currentConversationId: conversationId,
        selectedKnowledgeBaseIds: knowledgeBaseIds,
      })

      // 同步到 SDK (useChat 内部 messages 改为新对话的, 这是单对话模型, 切了就是切了)
      getModuleAIChatRuntime()?.setMessages(transcript)
      useCompactionStore.getState().setCompaction(compaction)

      // 加载完后扫一次 pending tool UI calls (恢复刷新前未答的弹框)
      restorePendingFromMessages(transcript)

      logger.info("[AIchatV2Store] 加载对话", {
        conversationId,
        messageCount: transcript.length,
        knowledgeBaseCount: conversation?.selectedKnowledgeBaseIds?.length || 0,
      })
    } catch (error) {
      logger.error("[AIchatV2Store] 加载对话失败", { error })
    }
  },

  // 加载所有对话
  loadConversations: async workspaceId => {
    try {
      const convs = await chatDB.getConversations(workspaceId)
      // 获取每条对话的消息数量
      const convsWithCounts = await Promise.all(
        convs.map(async conv => {
          const messages = await chatDB.loadMessages(conv.id)
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
      await chatDB.deleteConversation(conversationId)

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
