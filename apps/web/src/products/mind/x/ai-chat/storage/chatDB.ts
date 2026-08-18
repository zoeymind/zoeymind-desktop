/**
 * AIchatV2 IndexedDB 存储服务
 * 用于持久化聊天历史记录
 */

/**
 * AIchat V2 IndexedDB 存储服务 (ChatDBService 类)
 *
 * 用于持久化 AI 聊天对话和消息历史。
 * 数据库名: zoey-chat-v2 (与 V1 的 chatDB 使用不同数据库，互不冲突)。
 *
 * 与 V1 chatDB 的关系:
 *   - V1 (features/mindmap/utils/storage/chatDB.ts) 是普通对象字面量模式，供 V1 store 使用。
 *   - 本文件是独立的 ChatDBService 类，供 V2 hooks 和 store 使用。
 *   - 两者使用不同的 IndexedDB 数据库名，并行运行互不干扰。
 *   - 后续 V1 迁移完成后，V1 的 chatDB 将被删除。
 */

import { openDB, type IDBPDatabase } from 'idb'
import type { UIMessage } from '@ai-sdk/react'
import { logger } from '@zoeymind/logger'

const DB_NAME = 'zoey-chat-v2'
const DB_VERSION = 4
const STORE_CONVERSATIONS = 'conversations'
const STORE_MESSAGES = 'messages'
/** v2: 跨对话记忆向量索引, key = messageId (全局唯一) */
const STORE_MESSAGE_EMBEDDINGS = 'messageEmbeddings'
/** v3: 压缩备份 — 每对话保留最近一次压缩前的原始消息, 供"撤销/查看原始"用 */
const STORE_COMPACTION_BACKUPS = 'compactionBackups'

/** 思维导图快照（用于持久化 diff 基线） */
export interface PersistedSnapshot {
  version: number
  /** 扁平化节点列表（不含 path，恢复时重建） */
  nodes: Array<{
    uid: string
    parentUid: string | null
    text: string
    type: '根节点' | '模块' | '用例' | '步骤' | '普通节点'
    depth: number
    steps?: string[]
    childCount: number
  }>
  timestamp: number
  /** SessionIdMapper 序列化状态 */
  idMapping?: {
    shortToUuid: Record<string, string>
    uuidToShort: Record<string, string>
    counter: number
    reserved: string[]
  }
}

/** 对话信息 */
export interface Conversation {
  id: string
  workspaceId: string
  title: string
  createdAt: number
  updatedAt: number
  selectedKnowledgeBaseIds?: string[] // RAG 知识库选择（会话级别）
  // 向后兼容：保留旧字段名
  selectedRAGDataSources?: string[]
  /** 思维导图 diff 基线快照 */
  mindmapSnapshot?: PersistedSnapshot
}

/** 消息记录 */
export interface ChatMessage extends UIMessage {
  conversationId: string
  timestamp: number
}

/** v2 新增: 消息向量索引 (跨对话长期记忆用) */
export interface MessageEmbedding {
  messageId: string
  conversationId: string
  role: 'user' | 'assistant'
  /** 用于召回后展示原文 + 拼到 system prompt */
  text: string
  /** Float32Array 序列化为普通 array, IndexedDB 不支持 typed array key 但能存 value */
  embedding: number[]
  timestamp: number
}

/** v3 新增: 压缩备份, 1 个 conversation 保留最近 1 次压缩前的原始消息 */
export interface CompactionBackup {
  conversationId: string
  /** 压缩发生时间 */
  compactedAt: number
  /** 压缩前的原始消息列表 (序列化后存) */
  originalMessages: UIMessage[]
  /** 这次压缩产出的摘要文本 */
  summary: string
  /** 压缩用的模型 id, 显示给用户 */
  modelId: string
  /** 被压缩的消息条数 (recentK 之前的部分) */
  compactedCount: number
}

class ChatDBService {
  private dbPromise: Promise<IDBPDatabase> | null = null

  /**
   * 初始化数据库连接
   */
  private async getDB(): Promise<IDBPDatabase> {
    if (!this.dbPromise) {
      this.dbPromise = openDB(DB_NAME, DB_VERSION, {
        async upgrade(db, oldVersion, newVersion, tx) {
          logger.info('[ChatDB] Upgrading database', { oldVersion, newVersion })

          // v3 及以前的初次建表 (新库直接建 workspaceId 索引)
          if (oldVersion < 3) {
            // 创建对话表
            if (!db.objectStoreNames.contains(STORE_CONVERSATIONS)) {
              const conversationStore = db.createObjectStore(STORE_CONVERSATIONS, { keyPath: 'id' })
              conversationStore.createIndex('workspaceId', 'workspaceId', { unique: false })
              conversationStore.createIndex('updatedAt', 'updatedAt', { unique: false })
            }

            // 创建消息表
            if (!db.objectStoreNames.contains(STORE_MESSAGES)) {
              const messageStore = db.createObjectStore(STORE_MESSAGES, {
                keyPath: ['conversationId', 'id']
              })
              messageStore.createIndex('conversationId', 'conversationId', { unique: false })
              messageStore.createIndex('timestamp', 'timestamp', { unique: false })
            }

            // v2 新增: 消息向量索引 (跨对话, 长期记忆召回用)
            if (!db.objectStoreNames.contains(STORE_MESSAGE_EMBEDDINGS)) {
              const embeddingStore = db.createObjectStore(STORE_MESSAGE_EMBEDDINGS, {
                keyPath: 'messageId'
              })
              embeddingStore.createIndex('conversationId', 'conversationId', { unique: false })
              embeddingStore.createIndex('timestamp', 'timestamp', { unique: false })
            }

            // v3 新增: 压缩备份, 1 个 conversationId 保留 1 条最近备份
            if (!db.objectStoreNames.contains(STORE_COMPACTION_BACKUPS)) {
              db.createObjectStore(STORE_COMPACTION_BACKUPS, { keyPath: 'conversationId' })
            }
          }

          // v3 → v4: projectId → workspaceId 字段 + 索引迁移
          // (#37 只改了 TS 字段名和 index 名, 忘了 bump DB_VERSION → 老库里 index 仍叫 'projectId',
          // 记录里字段也仍是 projectId, 新代码 store.index('workspaceId') 抛 NotFoundError.)
          if (oldVersion < 4 && db.objectStoreNames.contains(STORE_CONVERSATIONS)) {
            const store = tx.objectStore(STORE_CONVERSATIONS)
            // 删旧 index
            if (store.indexNames.contains('projectId')) {
              store.deleteIndex('projectId')
            }
            // 迁移每条 conversation 记录 projectId → workspaceId
            let cursor = await store.openCursor()
            while (cursor) {
              const value = cursor.value as Record<string, unknown>
              if ('projectId' in value && !('workspaceId' in value)) {
                value.workspaceId = value.projectId
                delete value.projectId
                await cursor.update(value)
              }
              cursor = await cursor.continue()
            }
            // 建新 index 指向 workspaceId (幂等: 已存在则跳过, 兼容干净新库)
            if (!store.indexNames.contains('workspaceId')) {
              store.createIndex('workspaceId', 'workspaceId', { unique: false })
            }
          }
        }
      })
    }
    return this.dbPromise
  }

  /**
   * 创建新对话
   */
  async createConversation(workspaceId: string, id?: string): Promise<Conversation> {
    try {
      const db = await this.getDB()
      // 生成 UUID (支持 HTTP 环境)
      const generateUUID = () => {
        if (typeof crypto !== 'undefined' && crypto.randomUUID) {
          return crypto.randomUUID()
        }
        // Fallback for HTTP environments
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
          const r = (Math.random() * 16) | 0
          const v = c === 'x' ? r : (r & 0x3) | 0x8
          return v.toString(16)
        })
      }

      const conversation: Conversation = {
        id: id || generateUUID(),
        workspaceId,
        title: '新对话',
        createdAt: Date.now(),
        updatedAt: Date.now()
      }

      await db.add(STORE_CONVERSATIONS, conversation)
      logger.info('[ChatDB] Created conversation', { conversationId: conversation.id })
      return conversation
    } catch (error) {
      logger.error('[ChatDB] Failed to create conversation', { error })
      throw error
    }
  }

  /**
   * 获取指定项目的所有对话（按更新时间倒序）
   *
   * 注意：在组织架构下，workspaceId 仍然有意义，它代表 TestCaseProject.id。
   * 聊天对话与项目关联，确保不同项目的对话相互隔离。
   */
  async getConversations(workspaceId: string): Promise<Conversation[]> {
    try {
      const db = await this.getDB()
      const tx = db.transaction(STORE_CONVERSATIONS, 'readonly')
      const store = tx.objectStore(STORE_CONVERSATIONS)
      const index = store.index('workspaceId')

      // 使用 workspaceId 索引查询，只获取该项目的对话
      const conversations = await index.getAll(workspaceId)

      // 按更新时间倒序排序
      conversations.sort((a, b) => b.updatedAt - a.updatedAt)

      return conversations
    } catch (error) {
      logger.error('[ChatDB] Failed to get conversations', { error, workspaceId })
      return []
    }
  }

  /**
   * 获取对话信息
   */
  async getConversation(conversationId: string): Promise<Conversation | undefined> {
    try {
      const db = await this.getDB()
      return await db.get(STORE_CONVERSATIONS, conversationId)
    } catch (error) {
      logger.error('[ChatDB] Failed to get conversation', { error })
      return undefined
    }
  }

  /**
   * 更新对话信息（标题、RAG 选择等）
   */
  async updateConversation(
    conversationId: string,
    updates: Partial<
      Pick<Conversation, 'title' | 'selectedKnowledgeBaseIds' | 'selectedRAGDataSources'>
    >
  ): Promise<void> {
    try {
      const db = await this.getDB()
      const conversation = await db.get(STORE_CONVERSATIONS, conversationId)

      if (!conversation) {
        logger.warn('[ChatDB] Conversation not found', { conversationId })
        return
      }

      const updated = {
        ...conversation,
        ...updates,
        updatedAt: Date.now()
      }

      await db.put(STORE_CONVERSATIONS, updated)
      logger.info('[ChatDB] Updated conversation', { conversationId })
    } catch (error) {
      logger.error('[ChatDB] Failed to update conversation', { error })
      throw error
    }
  }

  /**
   * 删除对话及其所有消息
   */
  async deleteConversation(conversationId: string): Promise<void> {
    try {
      const db = await this.getDB()
      const tx = db.transaction([STORE_CONVERSATIONS, STORE_MESSAGES], 'readwrite')

      // 删除对话
      await tx.objectStore(STORE_CONVERSATIONS).delete(conversationId)

      // 删除该对话的所有消息
      const messageStore = tx.objectStore(STORE_MESSAGES)
      const index = messageStore.index('conversationId')
      const messages = await index.getAllKeys(conversationId)

      for (const key of messages) {
        await messageStore.delete(key)
      }

      await tx.done
      logger.info('[ChatDB] Deleted conversation', {
        conversationId,
        messageCount: messages.length
      })
    } catch (error) {
      logger.error('[ChatDB] Failed to delete conversation', { error })
      throw error
    }
  }

  /**
   * 保存消息到对话
   */
  async saveMessages(conversationId: string, messages: UIMessage[]): Promise<void> {
    try {
      const db = await this.getDB()
      const tx = db.transaction([STORE_CONVERSATIONS, STORE_MESSAGES], 'readwrite')

      const baseTimestamp = Date.now()
      const messageStore = tx.objectStore(STORE_MESSAGES)
      const index = messageStore.index('conversationId')

      // 计算最新消息 ID 集合
      const latestMessageIds = new Set<string>()
      for (let i = 0; i < messages.length; i++) {
        const message = messages[i]
        if (typeof message.id !== 'string' || !message.id) {
          throw new Error('UIMessage 缺少 id，无法持久化到 IndexedDB')
        }
        latestMessageIds.add(message.id)
      }

      // 清理不再存在的旧消息，避免历史记录残留
      const existingKeys = await index.getAllKeys(conversationId)
      for (const key of existingKeys) {
        let messageId: string | undefined
        if (Array.isArray(key)) {
          messageId = String(key[1])
        } else if (typeof key === 'string') {
          messageId = key
        }

        if (messageId && !latestMessageIds.has(messageId)) {
          await messageStore.delete(key)
        }
      }

      // 保存所有消息，为每条消息添加递增的 timestamp 确保顺序
      for (let i = 0; i < messages.length; i++) {
        const message = messages[i]
        const chatMessage: ChatMessage = {
          ...message,
          conversationId,
          timestamp: baseTimestamp + i // 使用递增的时间戳确保顺序
        }
        await messageStore.put(chatMessage)
      }

      // 更新对话的 updatedAt
      const conversation = await tx.objectStore(STORE_CONVERSATIONS).get(conversationId)
      if (conversation) {
        conversation.updatedAt = baseTimestamp

        // 如果是第一条消息，尝试提取标题
        if (messages.length > 0 && conversation.title === '新对话') {
          const firstUserMessage = messages.find(m => m.role === 'user')
          if (firstUserMessage) {
            const textPart = firstUserMessage.parts?.find(p => p.type === 'text')
            if (textPart && 'text' in textPart) {
              conversation.title = textPart.text.slice(0, 50) // 取前50个字符作为标题
            }
          }
        }

        await tx.objectStore(STORE_CONVERSATIONS).put(conversation)
      }

      await tx.done
      logger.info('[ChatDB] Saved messages', { conversationId, count: messages.length })
    } catch (error) {
      logger.error('[ChatDB] Failed to save messages', { error })
      throw error
    }
  }

  /**
   * 加载对话的所有消息（按时间顺序）
   */
  async loadMessages(conversationId: string): Promise<UIMessage[]> {
    try {
      const db = await this.getDB()
      const tx = db.transaction(STORE_MESSAGES, 'readonly')
      const index = tx.store.index('conversationId')
      const chatMessages = await index.getAll(conversationId)

      // 按时间顺序排序
      chatMessages.sort((a, b) => a.timestamp - b.timestamp)

      // 移除 conversationId 和 timestamp 字段，返回纯 UIMessage

      return chatMessages.map(({ conversationId: _, timestamp: __, ...message }) => message)
    } catch (error) {
      logger.error('[ChatDB] Failed to load messages', { error })
      return []
    }
  }

  /**
   * 保存思维导图快照到对话（用于 diff 基线持久化）
   */
  async saveSnapshot(conversationId: string, snapshot: PersistedSnapshot): Promise<void> {
    try {
      const db = await this.getDB()
      const conversation = await db.get(STORE_CONVERSATIONS, conversationId)
      if (!conversation) return

      conversation.mindmapSnapshot = snapshot
      await db.put(STORE_CONVERSATIONS, conversation)
    } catch (error) {
      // 快照保存失败不影响主流程，仅 warn
      logger.warn('[ChatDB] Failed to save snapshot', { error, conversationId })
    }
  }

  /**
   * 加载对话的思维导图快照
   */
  async loadSnapshot(conversationId: string): Promise<PersistedSnapshot | undefined> {
    try {
      const db = await this.getDB()
      const conversation = await db.get(STORE_CONVERSATIONS, conversationId)
      return conversation?.mindmapSnapshot
    } catch (error) {
      logger.warn('[ChatDB] Failed to load snapshot', { error, conversationId })
      return undefined
    }
  }

  /**
   * 清空项目的所有对话
   */
  async clearProjectChats(workspaceId: string): Promise<void> {
    try {
      await this.getDB() // 确保 DB 已初始化
      const conversations = await this.getConversations(workspaceId)

      for (const conversation of conversations) {
        await this.deleteConversation(conversation.id)
      }

      logger.info('[ChatDB] Cleared project chats', { workspaceId, count: conversations.length })
    } catch (error) {
      logger.error('[ChatDB] Failed to clear project chats', { error })
      throw error
    }
  }

  /** 拉所有对话的所有消息 (回填记忆用, 数量大概率千级以内, 一次性 OK) */
  async getAllMessagesAcrossConversations(): Promise<ChatMessage[]> {
    try {
      const db = await this.getDB()
      return await db.getAll(STORE_MESSAGES)
    } catch (error) {
      logger.error('[ChatDB] getAllMessagesAcrossConversations 失败', { error })
      return []
    }
  }

  // ===== 长期记忆: 消息向量 CRUD =====

  /** 写入一条消息的 embedding (idempotent — putAll 走主键覆盖) */
  async putMessageEmbedding(entry: MessageEmbedding): Promise<void> {
    try {
      const db = await this.getDB()
      await db.put(STORE_MESSAGE_EMBEDDINGS, entry)
    } catch (error) {
      logger.error('[ChatDB] putMessageEmbedding 失败', { error, messageId: entry.messageId })
      throw error
    }
  }

  /** 批量写入 (回填时用) */
  async putMessageEmbeddings(entries: MessageEmbedding[]): Promise<void> {
    if (entries.length === 0) return
    try {
      const db = await this.getDB()
      const tx = db.transaction(STORE_MESSAGE_EMBEDDINGS, 'readwrite')
      await Promise.all(entries.map(e => tx.store.put(e)))
      await tx.done
    } catch (error) {
      logger.error('[ChatDB] putMessageEmbeddings 失败', { error, count: entries.length })
      throw error
    }
  }

  /** 拉全部向量 (用于召回时的内存 cosine search; 数量上限千级, 全量加载 OK) */
  async getAllMessageEmbeddings(): Promise<MessageEmbedding[]> {
    try {
      const db = await this.getDB()
      return await db.getAll(STORE_MESSAGE_EMBEDDINGS)
    } catch (error) {
      logger.error('[ChatDB] getAllMessageEmbeddings 失败', { error })
      return []
    }
  }

  /** 已索引 messageId 集合 (回填时用来跳过已 embed 过的消息) */
  async getIndexedMessageIds(): Promise<Set<string>> {
    try {
      const db = await this.getDB()
      const keys = await db.getAllKeys(STORE_MESSAGE_EMBEDDINGS)
      return new Set(keys.map(k => String(k)))
    } catch (error) {
      logger.error('[ChatDB] getIndexedMessageIds 失败', { error })
      return new Set()
    }
  }

  /** 删除一条向量 (消息被 restoreMessage 时用) */
  async deleteMessageEmbedding(messageId: string): Promise<void> {
    try {
      const db = await this.getDB()
      await db.delete(STORE_MESSAGE_EMBEDDINGS, messageId)
    } catch (error) {
      logger.error('[ChatDB] deleteMessageEmbedding 失败', { error, messageId })
    }
  }

  /** 清空所有记忆 (设置页"清空记忆"按钮) */
  async clearAllEmbeddings(): Promise<void> {
    try {
      const db = await this.getDB()
      await db.clear(STORE_MESSAGE_EMBEDDINGS)
      logger.info('[ChatDB] 已清空所有 messageEmbeddings')
    } catch (error) {
      logger.error('[ChatDB] clearAllEmbeddings 失败', { error })
      throw error
    }
  }

  /** 估算 embedding 存储用量 (粗略, 每条按 384 * 4 + 元数据 ~200 估) */
  async estimateEmbeddingsBytes(): Promise<number> {
    try {
      const db = await this.getDB()
      const count = await db.count(STORE_MESSAGE_EMBEDDINGS)
      return count * (384 * 4 + 200)
    } catch {
      return 0
    }
  }

  // ===== Compaction 备份 =====

  /** 写入 / 覆盖 1 条压缩备份 (每 conversation 一份, 后面再压缩会覆盖) */
  async putCompactionBackup(entry: CompactionBackup): Promise<void> {
    try {
      const db = await this.getDB()
      await db.put(STORE_COMPACTION_BACKUPS, entry)
    } catch (error) {
      logger.error('[ChatDB] putCompactionBackup 失败', {
        error,
        conversationId: entry.conversationId
      })
    }
  }

  async getCompactionBackup(conversationId: string): Promise<CompactionBackup | null> {
    try {
      const db = await this.getDB()
      const v = await db.get(STORE_COMPACTION_BACKUPS, conversationId)
      return (v as CompactionBackup | undefined) ?? null
    } catch (error) {
      logger.error('[ChatDB] getCompactionBackup 失败', { error, conversationId })
      return null
    }
  }

  async deleteCompactionBackup(conversationId: string): Promise<void> {
    try {
      const db = await this.getDB()
      await db.delete(STORE_COMPACTION_BACKUPS, conversationId)
    } catch (error) {
      logger.error('[ChatDB] deleteCompactionBackup 失败', { error, conversationId })
    }
  }
}

// 导出单例
export const chatDB = new ChatDBService()
