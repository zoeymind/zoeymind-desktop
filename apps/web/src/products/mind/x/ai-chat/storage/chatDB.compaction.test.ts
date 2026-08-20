import { describe, expect, it } from "vitest"
import type { UIMessage } from "ai"
import { ChatDBService, type CompactionState, type SqlAdapter } from "./chatDB"
import { mergeLegacyTranscript } from "./legacyChatImport"

const messages: UIMessage[] = [
  { id: "u1", role: "user", parts: [{ type: "text", text: "one" }] },
  { id: "a1", role: "assistant", parts: [{ type: "text", text: "answer" }] },
  { id: "u2", role: "user", parts: [{ type: "text", text: "two" }] },
]

function state(): CompactionState {
  return {
    conversationId: "conversation",
    summary: "summary",
    summaryMessageId: "summary-message",
    compactedThroughMessageId: "a1",
    compactedAt: 1,
    modelId: "model",
    compactedCount: 2,
    tokensBefore: 100,
  }
}

class MemorySql implements SqlAdapter {
  conversations = new Map<
    string,
    { id: string; projectId: string; title: string; createdAt: number; updatedAt: number }
  >()
  runtime = new Map<string, { transcript: UIMessage[]; compaction: CompactionState | null }>()

  async select<T extends object>(sql: string, args: unknown[] = []): Promise<T[]> {
    const id = String(args[0] ?? "")
    if (sql.includes("FROM chat_runtime_state WHERE conversation_id")) {
      const row = this.runtime.get(id)
      return row
        ? ([
            {
              transcript_json: JSON.stringify(row.transcript),
              compaction_json: row.compaction ? JSON.stringify(row.compaction) : null,
            },
          ] as T[])
        : []
    }
    if (sql.includes("FROM chat_conversations c") && sql.includes("WHERE c.id")) {
      const row = this.conversations.get(id)
      return row
        ? ([
            {
              id: row.id,
              project_id: row.projectId,
              title: row.title,
              created_at: row.createdAt,
              updated_at: row.updatedAt,
              selected_knowledge_base_ids_json: "[]",
              snapshot_json: null,
            },
          ] as T[])
        : []
    }
    if (sql.includes("chat_storage_migrations")) return []
    if (sql.includes("chat_message_embeddings")) return []
    return []
  }

  async execute(sql: string, args: unknown[] = []): Promise<{ rowsAffected: number }> {
    if (sql.startsWith("INSERT INTO chat_conversations")) {
      this.conversations.set(String(args[0]), {
        id: String(args[0]),
        projectId: String(args[1] ?? ""),
        title: String(args[2]),
        createdAt: Number(args[3]),
        updatedAt: Number(args[4]),
      })
    } else if (sql.startsWith("INSERT INTO chat_runtime_state")) {
      const id = String(args[0])
      if (!this.runtime.has(id)) this.runtime.set(id, { transcript: [], compaction: null })
    } else if (sql.includes("SET transcript_json = $1, compaction_json")) {
      this.runtime.set(String(args[3]), {
        transcript: JSON.parse(String(args[0])) as UIMessage[],
        compaction: args[1] ? (JSON.parse(String(args[1])) as CompactionState) : null,
      })
    } else if (sql.includes("SET transcript_json = $1")) {
      const id = String(args[2])
      const current = this.runtime.get(id) ?? { transcript: [], compaction: null }
      current.transcript = JSON.parse(String(args[0])) as UIMessage[]
      this.runtime.set(id, current)
    } else if (sql.startsWith("DELETE FROM chat_conversations")) {
      const id = String(args[0])
      this.conversations.delete(id)
      this.runtime.delete(id)
    }
    return { rowsAffected: 1 }
  }
}

function service(sql: MemorySql): ChatDBService {
  return new ChatDBService(sql, async () => undefined)
}

async function seeded(): Promise<{ db: ChatDBService; sql: MemorySql }> {
  const sql = new MemorySql()
  const db = service(sql)
  await db.createConversation("workspace", "conversation")
  return { db, sql }
}

describe("ChatDB SQLite compaction persistence", () => {
  it("atomically stores state while preserving every transcript row", async () => {
    const { db } = await seeded()
    await db.commitCompaction("conversation", messages, state())
    expect(await db.loadConversationState("conversation")).toEqual({
      transcript: messages,
      compaction: state(),
    })
  })

  it("preserves state when truncating after the boundary", async () => {
    const { db } = await seeded()
    await db.commitCompaction("conversation", messages, state())
    await db.truncateConversation("conversation", messages.slice(0, 2))
    expect((await db.loadConversationState("conversation")).compaction).toEqual(state())
  })

  it("invalidates state when truncating before the boundary", async () => {
    const { db } = await seeded()
    await db.commitCompaction("conversation", messages, state())
    await db.truncateConversation("conversation", messages.slice(0, 1))
    expect(await db.loadConversationState("conversation")).toEqual({
      transcript: messages.slice(0, 1),
      compaction: null,
    })
  })

  it("deletes transcript and state with the conversation", async () => {
    const { db } = await seeded()
    await db.commitCompaction("conversation", messages, state())
    await db.deleteConversation("conversation")
    expect(await db.loadConversationState("conversation")).toEqual({
      transcript: [],
      compaction: null,
    })
  })

  it("imports legacy originals without dropping messages sent after compaction", () => {
    const postCompaction = {
      id: "a2",
      role: "assistant" as const,
      parts: [{ type: "text" as const, text: "new answer" }],
    }
    const migrated = mergeLegacyTranscript(
      [
        {
          id: "legacy-summary",
          role: "assistant",
          parts: [{ type: "text", text: "summary" }],
          metadata: { isCompactSummary: true },
          conversationId: "conversation",
          timestamp: 20,
        },
        { ...messages[2], conversationId: "conversation", timestamp: 21 },
        { ...postCompaction, conversationId: "conversation", timestamp: 22 },
      ],
      {
        conversationId: "conversation",
        compactedAt: 10,
        originalMessages: messages,
        summary: "summary",
        modelId: "model",
        compactedCount: 2,
      }
    )
    expect(migrated.transcript).toEqual([...messages, postCompaction])
    expect(migrated.compaction?.compactedThroughMessageId).toBe("a1")
  })
})
