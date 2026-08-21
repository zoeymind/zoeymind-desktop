import type { UIMessage } from "ai"
import { execute, select, type Row } from "@/shared/native/db"
import { importLegacyChatData } from "./legacyChatImport"

export interface Conversation {
  id: string
  workspaceId: string
  title: string
  createdAt: number
  updatedAt: number
  selectedKnowledgeBaseIds?: string[]
  selectedRAGDataSources?: string[]
}

export interface ChatMessage extends UIMessage {
  conversationId: string
  timestamp: number
}

export interface MessageEmbedding {
  messageId: string
  conversationId: string
  role: "user" | "assistant"
  text: string
  embedding: number[]
  timestamp: number
}

export interface CompactionState {
  conversationId: string
  summary: string
  summaryMessageId: string
  compactedThroughMessageId: string
  compactedAt: number
  modelId: string
  compactedCount: number
  tokensBefore: number
}

interface ConversationRow extends Row {
  id: string
  project_id: string | null
  workspace_id: string | null
  title: string
  created_at: number
  updated_at: number
  selected_knowledge_base_ids_json: string | null
  snapshot_json: string | null
}
interface RuntimeStateRow extends Row {
  transcript_json: string
  compaction_json: string | null
}
interface EmbeddingRow extends Row {
  message_id: string
  conversation_id: string
  role: "user" | "assistant"
  text: string
  embedding_json: string
  created_at: number
}

export interface SqlAdapter {
  select<T extends Row = Row>(sql: string, args?: unknown[]): Promise<T[]>
  execute(sql: string, args?: unknown[]): Promise<{ rowsAffected: number; lastInsertId?: number }>
}

const defaultSql: SqlAdapter = { select, execute }
const NEW_CONVERSATION_TITLE = "新对话"

function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

function firstUserText(messages: UIMessage[]): string | undefined {
  const firstUser = messages.find(message => message.role === "user")
  const text = firstUser?.parts?.find(part => part.type === "text")
  return text?.type === "text" ? text.text : undefined
}

function toConversation(row: ConversationRow): Conversation {
  const selectedKnowledgeBaseIds = parseJson<string[]>(row.selected_knowledge_base_ids_json, [])
  return {
    id: row.id,
    workspaceId: row.workspace_id ?? row.project_id ?? "",
    title: row.title,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    selectedKnowledgeBaseIds: selectedKnowledgeBaseIds.length
      ? selectedKnowledgeBaseIds
      : undefined,
  }
}

export class ChatDBService {
  private readyPromise: Promise<void> | null = null
  private readonly sql: SqlAdapter
  private readonly importLegacy: (service: ChatDBService, sql: SqlAdapter) => Promise<void>

  constructor(
    sql: SqlAdapter = defaultSql,
    importLegacy: (service: ChatDBService, sql: SqlAdapter) => Promise<void> = importLegacyChatData
  ) {
    this.sql = sql
    this.importLegacy = importLegacy
  }

  private ready(): Promise<void> {
    if (!this.readyPromise) {
      this.readyPromise = this.importLegacy(this, this.sql).catch(error => {
        this.readyPromise = null
        throw error
      })
    }
    return this.readyPromise
  }

  async createConversation(
    workspaceId: string,
    id: string = crypto.randomUUID()
  ): Promise<Conversation> {
    await this.ready()
    const now = Date.now()
    await this.sql.execute(
      "INSERT INTO chat_conversations (id, project_id, title, created_at, updated_at) VALUES ($1,$2,$3,$4,$5)",
      [id, null, NEW_CONVERSATION_TITLE, now, now]
    )
    await this.sql.execute(
      "INSERT INTO chat_runtime_state (conversation_id, workspace_id, transcript_json, updated_at) VALUES ($1,$2,$3,$4)",
      [id, workspaceId, "[]", now]
    )
    return { id, workspaceId, title: NEW_CONVERSATION_TITLE, createdAt: now, updatedAt: now }
  }

  async getConversations(workspaceId: string): Promise<Conversation[]> {
    await this.ready()
    const rows = await this.sql.select<ConversationRow>(
      `SELECT c.*, s.workspace_id, s.selected_knowledge_base_ids_json, s.snapshot_json
       FROM chat_conversations c LEFT JOIN chat_runtime_state s ON s.conversation_id = c.id
       WHERE s.workspace_id = $1 ORDER BY c.updated_at DESC`,
      [workspaceId]
    )
    return rows.map(toConversation)
  }

  async getConversation(conversationId: string): Promise<Conversation | undefined> {
    await this.ready()
    return this.getConversationDirect(conversationId)
  }

  async updateConversation(
    conversationId: string,
    updates: Partial<
      Pick<Conversation, "title" | "selectedKnowledgeBaseIds" | "selectedRAGDataSources">
    >
  ): Promise<void> {
    await this.ready()
    const now = Date.now()
    if (updates.title !== undefined) {
      await this.sql.execute(
        "UPDATE chat_conversations SET title = $1, updated_at = $2 WHERE id = $3",
        [updates.title, now, conversationId]
      )
    }
    const knowledgeBaseIds = updates.selectedKnowledgeBaseIds ?? updates.selectedRAGDataSources
    if (knowledgeBaseIds !== undefined) {
      await this.ensureRuntimeState(conversationId, now)
      await this.sql.execute(
        "UPDATE chat_runtime_state SET selected_knowledge_base_ids_json = $1, updated_at = $2 WHERE conversation_id = $3",
        [JSON.stringify(knowledgeBaseIds), now, conversationId]
      )
    }
  }

  async deleteConversation(conversationId: string): Promise<void> {
    await this.ready()
    await this.sql.execute("DELETE FROM chat_conversations WHERE id = $1", [conversationId])
  }

  async saveMessages(conversationId: string, messages: UIMessage[]): Promise<void> {
    await this.writeTranscript(conversationId, messages)
  }

  async loadConversationState(
    conversationId: string
  ): Promise<{ transcript: UIMessage[]; compaction: CompactionState | null }> {
    await this.ready()
    const rows = await this.sql.select<RuntimeStateRow>(
      "SELECT transcript_json, compaction_json FROM chat_runtime_state WHERE conversation_id = $1",
      [conversationId]
    )
    const transcript = parseJson<UIMessage[]>(rows[0]?.transcript_json, [])
    const persisted = parseJson<CompactionState | null>(rows[0]?.compaction_json, null)
    const compaction =
      persisted && transcript.some(message => message.id === persisted.compactedThroughMessageId)
        ? persisted
        : null
    return { transcript, compaction }
  }

  async commitCompaction(
    conversationId: string,
    transcript: UIMessage[],
    state: CompactionState
  ): Promise<void> {
    await this.writeTranscript(conversationId, transcript, state)
  }

  async truncateConversation(conversationId: string, transcript: UIMessage[]): Promise<void> {
    const current = await this.loadConversationState(conversationId)
    const state =
      current.compaction &&
      transcript.some(message => message.id === current.compaction?.compactedThroughMessageId)
        ? current.compaction
        : null
    await this.writeTranscript(conversationId, transcript, state)
  }

  private async writeTranscript(
    conversationId: string,
    messages: UIMessage[],
    compaction?: CompactionState | null
  ): Promise<void> {
    await this.ready()
    for (const message of messages) {
      if (!message.id) throw new Error("UIMessage 缺少 id，无法持久化到 SQLite")
    }
    const now = Date.now()
    await this.ensureRuntimeState(conversationId, now)
    if (compaction === undefined) {
      await this.sql.execute(
        "UPDATE chat_runtime_state SET transcript_json = $1, updated_at = $2 WHERE conversation_id = $3",
        [JSON.stringify(messages), now, conversationId]
      )
    } else {
      await this.sql.execute(
        "UPDATE chat_runtime_state SET transcript_json = $1, compaction_json = $2, updated_at = $3 WHERE conversation_id = $4",
        [
          JSON.stringify(messages),
          compaction ? JSON.stringify(compaction) : null,
          now,
          conversationId,
        ]
      )
    }
    const conversation = await this.getConversationDirect(conversationId)
    const title =
      conversation?.title === NEW_CONVERSATION_TITLE
        ? firstUserText(messages)?.slice(0, 50)
        : undefined
    await this.sql.execute(
      "UPDATE chat_conversations SET title = COALESCE($1, title), updated_at = $2 WHERE id = $3",
      [title ?? null, now, conversationId]
    )
  }

  async loadMessages(conversationId: string): Promise<UIMessage[]> {
    return (await this.loadConversationState(conversationId)).transcript
  }

  async clearProjectChats(workspaceId: string): Promise<void> {
    await this.ready()
    await this.sql.execute(
      "DELETE FROM chat_conversations WHERE id IN (SELECT conversation_id FROM chat_runtime_state WHERE workspace_id = $1)",
      [workspaceId]
    )
  }

  async getAllMessagesAcrossConversations(): Promise<ChatMessage[]> {
    await this.ready()
    const rows = await this.sql.select<{ conversation_id: string; transcript_json: string }>(
      "SELECT conversation_id, transcript_json FROM chat_runtime_state"
    )
    return rows.flatMap(row =>
      parseJson<UIMessage[]>(row.transcript_json, []).map((message, index) => ({
        ...message,
        conversationId: row.conversation_id,
        timestamp: index,
      }))
    )
  }

  async putMessageEmbedding(entry: MessageEmbedding): Promise<void> {
    await this.ready()
    await this.putMessageEmbeddingDirect(entry, true)
  }

  async putMessageEmbeddings(entries: MessageEmbedding[]): Promise<void> {
    for (const entry of entries) await this.putMessageEmbedding(entry)
  }

  async getAllMessageEmbeddings(): Promise<MessageEmbedding[]> {
    await this.ready()
    const rows = await this.sql.select<EmbeddingRow>(
      "SELECT message_id, conversation_id, role, text, embedding_json, created_at FROM chat_message_embeddings"
    )
    return rows.map(row => ({
      messageId: row.message_id,
      conversationId: row.conversation_id,
      role: row.role,
      text: row.text,
      embedding: parseJson<number[]>(row.embedding_json, []),
      timestamp: row.created_at,
    }))
  }

  async getIndexedMessageIds(): Promise<Set<string>> {
    await this.ready()
    const rows = await this.sql.select<{ message_id: string }>(
      "SELECT message_id FROM chat_message_embeddings"
    )
    return new Set(rows.map(row => row.message_id))
  }

  async deleteMessageEmbedding(messageId: string): Promise<void> {
    await this.ready()
    await this.sql.execute("DELETE FROM chat_message_embeddings WHERE message_id = $1", [messageId])
  }

  async clearAllEmbeddings(): Promise<void> {
    await this.ready()
    await this.sql.execute("DELETE FROM chat_message_embeddings")
  }

  async estimateEmbeddingsBytes(): Promise<number> {
    await this.ready()
    const rows = await this.sql.select<{ bytes: number }>(
      "SELECT COALESCE(SUM(LENGTH(embedding_json) + LENGTH(text)), 0) AS bytes FROM chat_message_embeddings"
    )
    return Number(rows[0]?.bytes ?? 0)
  }

  async importConversation(
    conversation: Conversation,
    transcript: UIMessage[],
    compaction: CompactionState | null,
    embeddings: MessageEmbedding[]
  ): Promise<void> {
    const existing = await this.getConversationDirect(conversation.id)
    if (!existing) {
      await this.sql.execute(
        "INSERT INTO chat_conversations (id, project_id, title, created_at, updated_at) VALUES ($1,$2,$3,$4,$5)",
        [conversation.id, null, conversation.title, conversation.createdAt, conversation.updatedAt]
      )
    }
    await this.sql.execute(
      `INSERT INTO chat_runtime_state
       (conversation_id, workspace_id, transcript_json, compaction_json, snapshot_json, selected_knowledge_base_ids_json, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(conversation_id) DO NOTHING`,
      [
        conversation.id,
        conversation.workspaceId,
        JSON.stringify(transcript),
        compaction ? JSON.stringify(compaction) : null,
        null,
        JSON.stringify(
          conversation.selectedKnowledgeBaseIds ?? conversation.selectedRAGDataSources ?? []
        ),
        conversation.updatedAt,
      ]
    )
    for (const embedding of embeddings) await this.putMessageEmbeddingDirect(embedding, false)
  }

  private async getConversationDirect(conversationId: string): Promise<Conversation | undefined> {
    const rows = await this.sql.select<ConversationRow>(
      `SELECT c.*, s.workspace_id, s.selected_knowledge_base_ids_json, s.snapshot_json
       FROM chat_conversations c LEFT JOIN chat_runtime_state s ON s.conversation_id = c.id
       WHERE c.id = $1`,
      [conversationId]
    )
    return rows[0] ? toConversation(rows[0]) : undefined
  }

  private async ensureRuntimeState(conversationId: string, now: number): Promise<void> {
    await this.sql.execute(
      `INSERT INTO chat_runtime_state (conversation_id, workspace_id, transcript_json, updated_at)
       VALUES ($1,$2,$3,$4) ON CONFLICT(conversation_id) DO NOTHING`,
      [conversationId, "", "[]", now]
    )
  }

  private async putMessageEmbeddingDirect(
    entry: MessageEmbedding,
    replace: boolean
  ): Promise<void> {
    const conflict = replace
      ? `DO UPDATE SET conversation_id = excluded.conversation_id, role = excluded.role,
           text = excluded.text, embedding_json = excluded.embedding_json, created_at = excluded.created_at`
      : "DO NOTHING"
    await this.sql.execute(
      `INSERT INTO chat_message_embeddings
       (message_id, conversation_id, role, text, embedding_json, created_at)
       VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT(message_id) ${conflict}`,
      [
        entry.messageId,
        entry.conversationId,
        entry.role,
        entry.text,
        JSON.stringify(entry.embedding),
        entry.timestamp,
      ]
    )
  }
}

export const chatDB = new ChatDBService()
