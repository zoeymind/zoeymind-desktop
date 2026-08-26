/**
 * 聊天历史面板
 */

import React, { useCallback, useState, useEffect } from "react"
import { useTranslation } from "@zoeymind/i18n"
import { motion, AnimatePresence } from "motion/react"
import { MessageSquare, Trash2, ChevronUp } from "lucide-react"
import { logger } from "@zoeymind/logger"
import { Tabs, TabsList, TabsTrigger } from "@zoeymind/ui"
import { sqliteChatStore, type Conversation as DBConversation } from "../../storage/sqliteChatStore"
import { formatRelativeTime } from "../../../ai-chat/utils/timeFormat"
import { DeleteConfirmDialog } from "./DeleteConfirmDialog"

interface Conversation extends DBConversation {
  messageCount: number
}

type ConversationScope = "project" | "all"

interface ChatHistoryPanelProps {
  isOpen: boolean
  onClose: () => void
  workspaceId: string
  onSelectConversation: (conversationId: string) => void
  currentConversationId?: string
}

export const ChatHistoryPanel: React.FC<ChatHistoryPanelProps> = ({
  isOpen,
  onClose,
  workspaceId,
  onSelectConversation,
  currentConversationId,
}) => {
  const { t } = useTranslation()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [scope, setScope] = useState<ConversationScope>("project")
  const [loading, setLoading] = useState(true)
  const [deleteDialog, setDeleteDialog] = useState<{
    isOpen: boolean
    conversationId: string
    title: string
    loading: boolean
  }>({
    isOpen: false,
    conversationId: "",
    title: "",
    loading: false,
  })

  const loadConversations = useCallback(async () => {
    try {
      setLoading(true)
      const convs =
        scope === "project"
          ? await sqliteChatStore.getConversations(workspaceId)
          : await sqliteChatStore.getAllConversations()
      const conversationsWithCount = await Promise.all(
        convs.map(async conv => ({
          ...conv,
          messageCount: (await sqliteChatStore.loadMessages(conv.id)).length,
        }))
      )
      setConversations(conversationsWithCount)
    } catch (error) {
      logger.error("[ChatHistoryPanel] Failed to load conversations", { error })
    } finally {
      setLoading(false)
    }
  }, [scope, workspaceId])
  useEffect(() => {
    if (!isOpen) return
    const frame = requestAnimationFrame(() => void loadConversations())
    return () => cancelAnimationFrame(frame)
  }, [isOpen, loadConversations])

  // 点击外部关闭面板
  useEffect(() => {
    if (!isOpen) return

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element
      // 如果点击的不是面板内部和历史按钮，则关闭面板
      if (
        !target.closest(".chat-history-panel") &&
        !target.closest("[data-chat-history-trigger]")
      ) {
        onClose()
      }
    }

    // 延迟添加监听器，避免立即触发
    const timer = setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside)
    }, 200)

    return () => {
      clearTimeout(timer)
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [isOpen, onClose])

  // 按时间分组对话
  const groupConversationsByTime = (conversations: Conversation[]) => {
    const groups: { [key: string]: Conversation[] } = {}

    conversations.forEach(conv => {
      const timeLabel = formatRelativeTime(conv.updatedAt)
      if (!groups[timeLabel]) {
        groups[timeLabel] = []
      }
      groups[timeLabel].push(conv)
    })

    // 对每个分组内的对话也进行排序（最新的在前）
    Object.values(groups).forEach(group => {
      group.sort((a, b) => b.updatedAt - a.updatedAt)
    })

    return Object.entries(groups).sort((a, b) => {
      // 按时间排序，最新的在前
      const aTime = a[1][0].updatedAt
      const bTime = b[1][0].updatedAt
      return bTime - aTime
    })
  }

  const handleSelectConversation = (conversationId: string) => {
    onSelectConversation(conversationId)
    onClose()
  }

  // 打开删除确认弹框
  const handleDeleteClick = (conversationId: string, title: string, e: React.MouseEvent) => {
    e.stopPropagation() // 阻止事件冒泡到选择对话
    setDeleteDialog({
      isOpen: true,
      conversationId,
      title,
      loading: false,
    })
  }

  // 确认删除对话
  const handleConfirmDelete = async () => {
    setDeleteDialog(prev => ({ ...prev, loading: true }))

    try {
      await sqliteChatStore.deleteConversation(deleteDialog.conversationId)

      // 重新加载对话列表
      await loadConversations()

      // 如果删除的是当前对话，切换到空对话
      if (currentConversationId === deleteDialog.conversationId) {
        await onSelectConversation("")
      }

      // 关闭弹框
      setDeleteDialog({
        isOpen: false,
        conversationId: "",
        title: "",
        loading: false,
      })
    } catch (error) {
      logger.error("[ChatHistoryPanel] Failed to delete conversation", { error })
      setDeleteDialog(prev => ({ ...prev, loading: false }))
    }
  }

  // 关闭删除确认弹框
  const handleCloseDeleteDialog = () => {
    if (!deleteDialog.loading) {
      setDeleteDialog({
        isOpen: false,
        conversationId: "",
        title: "",
        loading: false,
      })
    }
  }

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="chat-history-panel absolute top-full left-0 right-0 bg-card border border-border shadow-lg z-20 rounded-b-lg"
          >
            {/* 内容 */}
            <div className="relative">
              <Tabs
                value={scope}
                onValueChange={value => setScope(value as ConversationScope)}
                className="gap-0 border-b border-border px-2 py-1.5"
              >
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="project" className="text-xs">
                    {t("mindmap.aiChat.history.tabs.currentProject")}
                  </TabsTrigger>
                  <TabsTrigger value="all" className="text-xs">
                    {t("mindmap.aiChat.history.tabs.allConversations")}
                  </TabsTrigger>
                </TabsList>
              </Tabs>
              <div className="h-60 overflow-y-auto">
                {loading ? (
                  <div className="p-3 text-center">
                    <div className="animate-spin size-3 border border-border border-t-foreground rounded-full mx-auto mb-1"></div>
                    <p className="text-[10px] text-muted-foreground">{t("common.loading")}</p>
                  </div>
                ) : conversations.length === 0 ? (
                  <div className="p-3 text-center">
                    <MessageSquare className="size-5 mx-auto mb-1.5 text-muted-foreground/50" />
                    <p className="text-[10px] text-muted-foreground">
                      {t("mindmap.aiChat.history.empty.title")}
                    </p>
                    <p className="text-[9px] text-muted-foreground/70 mt-0.5">
                      {t("mindmap.aiChat.history.empty.hint")}
                    </p>
                  </div>
                ) : (
                  <div className="p-0.5">
                    {groupConversationsByTime(conversations).map(([timeLabel, group]) => (
                      <div key={timeLabel}>
                        <div className="px-3 py-1 text-xs text-muted-foreground font-medium">
                          {timeLabel}
                        </div>
                        {group.map(conversation => (
                          <div key={conversation.id} className="relative group">
                            <button
                              type="button"
                              className={`w-full text-left p-2.5 hover:bg-muted/50 transition-colors ${
                                currentConversationId === conversation.id ? "bg-muted" : ""
                              }`}
                              onClick={() => handleSelectConversation(conversation.id)}
                            >
                              <div className="flex items-start gap-2.5 w-full">
                                <MessageSquare className="size-3 text-muted-foreground mt-0.5 flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <div className="text-xs font-medium flex items-center justify-between">
                                    <span className="truncate max-w-[200px]">
                                      {conversation.title}
                                    </span>
                                    <span className="text-[10px] text-muted-foreground/70 ml-2 flex-shrink-0">
                                      {conversation.messageCount}
                                    </span>
                                  </div>
                                </div>
                                {currentConversationId === conversation.id && (
                                  <div className="size-1.5 bg-primary rounded-full flex-shrink-0 mt-0.5"></div>
                                )}
                              </div>
                            </button>
                            {/* 删除按钮 - 独立在外层 */}
                            <button
                              type="button"
                              className="absolute right-1 top-1/2 -translate-y-1/2 size-5 opacity-0 group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive rounded transition-all"
                              onClick={e =>
                                handleDeleteClick(conversation.id, conversation.title, e)
                              }
                            >
                              <Trash2 className="size-2.5 m-auto" />
                            </button>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 浮动收起按钮 */}
              <div className="absolute bottom-0 left-0 right-0 flex justify-center">
                <div className="bg-card/90 backdrop-blur-sm border border-border rounded-t-lg px-2 py-1">
                  <button
                    type="button"
                    className="size-5 flex items-center justify-center hover:bg-muted rounded transition-colors"
                    onClick={onClose}
                  >
                    <ChevronUp className="size-3" />
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 删除确认弹框 */}
      <DeleteConfirmDialog
        isOpen={deleteDialog.isOpen}
        onClose={handleCloseDeleteDialog}
        onConfirm={handleConfirmDelete}
        title={deleteDialog.title}
        loading={deleteDialog.loading}
      />
    </>
  )
}
