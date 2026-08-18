/**
 * SqlChatRepo —— AI Chat 会话/消息持久化，全部走 app.db。
 *
 * 产品仓的 AI Chat 用 IndexedDB (`chatDB`)；桌面端按用户方案改为 SQLite 单一
 * 持久层，让备份/迁移/查询都统一。产品仓的 `apps/zoeymind/x/web/mind/ai-chat/
 * storage/chatDB.ts` 与本 repo 表面对齐（listConversations / createConversation /
 * getMessages / appendMessage / deleteConversation / setTitle），替换时改
 * import 路径即可。
 */
import { select, execute } from './db'

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
  role: 'user' | 'assistant' | 'tool' | 'system'
  content: unknown
  createdAt: number
}

interface RawConv {
  id: string
  project_id: string | null
  title: string
  created_at: number
  updated_at: number
}

interface RawMsg {
  id: string
  conversation_id: string
  role: string
  content_json: string
  created_at: number
}

function toConv(row: RawConv): ChatConversationRow {
  return {
    id: row.id,
    projectId: row.project_id,
    title: row.title,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

const ALLOWED_ROLES: Record<string, ChatMessageRow['role']> = {
  user: 'user',
  assistant: 'assistant',
  tool: 'tool',
  system: 'system'
}

function toMsg(row: RawMsg): ChatMessageRow {
  const role = ALLOWED_ROLES[row.role] ?? 'system'
  let content: unknown = null
  try {
    content = JSON.parse(row.content_json)
  } catch {
    content = row.content_json
  }
  return { id: row.id, conversationId: row.conversation_id, role, content, createdAt: row.created_at }
}

export async function listConversations(projectId?: string | null): Promise<ChatConversationRow[]> {
  const rows =
    projectId === undefined
      ? await select<RawConv>(`SELECT * FROM chat_conversations ORDER BY updated_at DESC`)
      : projectId === null
        ? await select<RawConv>(
            `SELECT * FROM chat_conversations WHERE project_id IS NULL ORDER BY updated_at DESC`
          )
        : await select<RawConv>(
            `SELECT * FROM chat_conversations WHERE project_id = $1 ORDER BY updated_at DESC`,
            [projectId]
          )
  return rows.map(toConv)
}

export async function createConversation(
  id: string,
  projectId: string | null,
  title: string = ''
): Promise<void> {
  const now = Date.now()
  await execute(
    `INSERT INTO chat_conversations (id, project_id, title, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $4)`,
    [id, projectId, title, now]
  )
}

export async function setConversationTitle(id: string, title: string): Promise<void> {
  await execute(
    `UPDATE chat_conversations SET title = $1, updated_at = $2 WHERE id = $3`,
    [title, Date.now(), id]
  )
}

export async function deleteConversation(id: string): Promise<void> {
  await execute(`DELETE FROM chat_conversations WHERE id = $1`, [id])
  // chat_messages 走 ON DELETE CASCADE 自动清
}

export async function getMessages(conversationId: string): Promise<ChatMessageRow[]> {
  const rows = await select<RawMsg>(
    `SELECT * FROM chat_messages WHERE conversation_id = $1 ORDER BY created_at ASC`,
    [conversationId]
  )
  return rows.map(toMsg)
}

export async function appendMessage(msg: ChatMessageRow): Promise<void> {
  await execute(
    `INSERT INTO chat_messages (id, conversation_id, role, content_json, created_at)
     VALUES ($1, $2, $3, $4, $5)`,
    [msg.id, msg.conversationId, msg.role, JSON.stringify(msg.content), msg.createdAt]
  )
  await execute(`UPDATE chat_conversations SET updated_at = $1 WHERE id = $2`, [
    Date.now(),
    msg.conversationId
  ])
}
