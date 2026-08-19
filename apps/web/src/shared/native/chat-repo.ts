/**
 * chat_conversations / chat_messages 的 CRUD (SqlProjectRepo 同一 db 实例).
 *
 * 表 schema 见 src-tauri/src/lib.rs migrations:
 *   chat_conversations(id, project_id, title, created_at, updated_at)
 *   chat_messages(id, conversation_id, role, content_json, created_at)
 *
 * content_json 目前只用于放 string content, 未来可扩展为 tool_calls / attachments 等.
 */
import { select, execute } from './db'
import { createUUID } from '@/shared/app-shared'

export interface ChatConversationRow {
  id: string
  projectId: string | null
  title: string
  createdAt: number
  updatedAt: number
}

export interface ChatMessageRow {
  id: string
  conversationId: string
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string
  createdAt: number
}

interface RawConvRow {
  id: string
  project_id: string | null
  title: string
  created_at: number
  updated_at: number
}
interface RawMessageRow {
  id: string
  conversation_id: string
  role: string
  content_json: string
  created_at: number
}

function toConv(r: RawConvRow): ChatConversationRow {
  return {
    id: r.id,
    projectId: r.project_id,
    title: r.title,
    createdAt: r.created_at,
    updatedAt: r.updated_at
  }
}

function parseContent(json: string): string {
  try {
    const parsed = JSON.parse(json)
    if (typeof parsed === 'string') return parsed
    if (parsed && typeof parsed.text === 'string') return parsed.text
    return json
  } catch {
    return json
  }
}

function toMessage(r: RawMessageRow): ChatMessageRow {
  return {
    id: r.id,
    conversationId: r.conversation_id,
    role: r.role as ChatMessageRow['role'],
    content: parseContent(r.content_json),
    createdAt: r.created_at
  }
}

export async function listConversations(projectId: string | null): Promise<ChatConversationRow[]> {
  const rows =
    projectId === null
      ? await select<RawConvRow>(
          'SELECT * FROM chat_conversations WHERE project_id IS NULL ORDER BY updated_at DESC'
        )
      : await select<RawConvRow>(
          'SELECT * FROM chat_conversations WHERE project_id = $1 ORDER BY updated_at DESC',
          [projectId]
        )
  return rows.map(toConv)
}

export async function createConversation(
  projectId: string | null,
  title: string = ''
): Promise<ChatConversationRow> {
  const id = createUUID()
  const now = Date.now()
  await execute(
    'INSERT INTO chat_conversations (id, project_id, title, created_at, updated_at) VALUES ($1,$2,$3,$4,$5)',
    [id, projectId, title, now, now]
  )
  return { id, projectId, title, createdAt: now, updatedAt: now }
}

export async function renameConversation(id: string, title: string): Promise<void> {
  await execute(
    'UPDATE chat_conversations SET title = $1, updated_at = $2 WHERE id = $3',
    [title, Date.now(), id]
  )
}

export async function deleteConversation(id: string): Promise<void> {
  await execute('DELETE FROM chat_conversations WHERE id = $1', [id])
}

export async function listMessages(conversationId: string): Promise<ChatMessageRow[]> {
  const rows = await select<RawMessageRow>(
    'SELECT * FROM chat_messages WHERE conversation_id = $1 ORDER BY created_at ASC',
    [conversationId]
  )
  return rows.map(toMessage)
}

export async function appendMessage(
  conversationId: string,
  role: ChatMessageRow['role'],
  content: string
): Promise<ChatMessageRow> {
  const id = createUUID()
  const now = Date.now()
  await execute(
    'INSERT INTO chat_messages (id, conversation_id, role, content_json, created_at) VALUES ($1,$2,$3,$4,$5)',
    [id, conversationId, role, JSON.stringify(content), now]
  )
  await execute('UPDATE chat_conversations SET updated_at = $1 WHERE id = $2', [
    now,
    conversationId
  ])
  return { id, conversationId, role, content, createdAt: now }
}

export async function updateMessage(id: string, content: string): Promise<void> {
  await execute('UPDATE chat_messages SET content_json = $1 WHERE id = $2', [
    JSON.stringify(content),
    id
  ])
}

export async function deleteMessage(id: string): Promise<void> {
  await execute('DELETE FROM chat_messages WHERE id = $1', [id])
}
