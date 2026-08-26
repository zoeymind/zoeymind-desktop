import { deleteDB, openDB } from "idb"
import type { UIMessage } from "ai"
import { logger } from "@zoeymind/logger"
import type {
  SqliteChatStore,
  CompactionState,
  Conversation,
  MessageEmbedding,
  SqlAdapter,
} from "./sqliteChatStore"

const LEGACY_DATABASE = "zoey-chat-v2"
const MIGRATION_KEY = "indexeddb-chat-v1"

interface LegacyMessage extends UIMessage {
  conversationId: string
  timestamp: number
}
interface LegacyBackup {
  conversationId: string
  compactedAt: number
  originalMessages: UIMessage[]
  summary: string
  modelId: string
  compactedCount: number
}

function withoutStorageFields(row: LegacyMessage): UIMessage {
  const { conversationId, timestamp, ...message } = row
  void conversationId
  void timestamp
  return message
}

export function mergeLegacyTranscript(
  rows: LegacyMessage[],
  backup: LegacyBackup | undefined
): { transcript: UIMessage[]; compaction: CompactionState | null } {
  const current = [...rows]
    .sort((left, right) => left.timestamp - right.timestamp)
    .map(withoutStorageFields)
  if (!backup || !Array.isArray(backup.originalMessages)) {
    return { transcript: current, compaction: null }
  }
  const boundary = backup.originalMessages[backup.compactedCount - 1]
  if (!boundary?.id) return { transcript: current, compaction: null }
  const originalIds = new Set(backup.originalMessages.map(message => message.id))
  const appended = current.filter(
    message =>
      !originalIds.has(message.id) &&
      !(message.metadata as { isCompactSummary?: boolean } | undefined)?.isCompactSummary
  )
  return {
    transcript: [...backup.originalMessages, ...appended],
    compaction: {
      conversationId: backup.conversationId,
      summary: backup.summary,
      summaryMessageId: `compact-${backup.conversationId}-${backup.compactedAt}`,
      compactedThroughMessageId: boundary.id,
      compactedAt: backup.compactedAt,
      modelId: backup.modelId,
      compactedCount: backup.compactedCount,
      tokensBefore: 0,
    },
  }
}

async function databaseExists(name: string): Promise<boolean> {
  if (!("databases" in indexedDB)) return true
  const databases = await indexedDB.databases()
  return databases.some(database => database.name === name)
}

export async function migrateIndexedDbToSqlite(
  service: SqliteChatStore,
  sql: SqlAdapter
): Promise<void> {
  const marker = await sql.select<{ migration_key: string }>(
    "SELECT migration_key FROM chat_storage_migrations WHERE migration_key = $1",
    [MIGRATION_KEY]
  )
  if (marker.length) {
    if (await databaseExists(LEGACY_DATABASE)) await deleteDB(LEGACY_DATABASE)
    return
  }
  if (!(await databaseExists(LEGACY_DATABASE))) {
    await sql.execute(
      "INSERT INTO chat_storage_migrations (migration_key, completed_at) VALUES ($1,$2)",
      [MIGRATION_KEY, Date.now()]
    )
    return
  }

  const database = await openDB(LEGACY_DATABASE)
  try {
    const conversations = database.objectStoreNames.contains("conversations")
      ? ((await database.getAll("conversations")) as Conversation[])
      : []
    const allMessages = database.objectStoreNames.contains("messages")
      ? ((await database.getAll("messages")) as LegacyMessage[])
      : []
    const backups = database.objectStoreNames.contains("compactionBackups")
      ? ((await database.getAll("compactionBackups")) as LegacyBackup[])
      : []
    const states = database.objectStoreNames.contains("compactionState")
      ? ((await database.getAll("compactionState")) as CompactionState[])
      : []
    const embeddings = database.objectStoreNames.contains("messageEmbeddings")
      ? ((await database.getAll("messageEmbeddings")) as MessageEmbedding[])
      : []

    for (const conversation of conversations) {
      const rows = allMessages.filter(message => message.conversationId === conversation.id)
      const persistedState = states.find(state => state.conversationId === conversation.id) ?? null
      const migrated = persistedState
        ? {
            transcript: rows
              .sort((left, right) => left.timestamp - right.timestamp)
              .map(withoutStorageFields),
            compaction: persistedState,
          }
        : mergeLegacyTranscript(
            rows,
            backups.find(backup => backup.conversationId === conversation.id)
          )
      await service.importConversation(
        conversation,
        migrated.transcript,
        migrated.compaction,
        embeddings.filter(embedding => embedding.conversationId === conversation.id)
      )
    }
    await sql.execute(
      "INSERT INTO chat_storage_migrations (migration_key, completed_at) VALUES ($1,$2)",
      [MIGRATION_KEY, Date.now()]
    )
  } finally {
    database.close()
  }

  await deleteDB(LEGACY_DATABASE)
  logger.info("[ChatDB] Imported legacy IndexedDB data into SQLite", {
    database: LEGACY_DATABASE,
  })
}
