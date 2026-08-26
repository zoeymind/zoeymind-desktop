import { describe, expect, it, vi } from "vitest"
import { SqliteChatStore, type SqlAdapter } from "./sqliteChatStore"

const rows = [
  {
    id: "conversation-b",
    project_id: null,
    workspace_id: "workspace-b",
    title: "Other project",
    created_at: 1,
    updated_at: 3,
    selected_knowledge_base_ids_json: null,
    snapshot_json: null,
  },
  {
    id: "conversation-a",
    project_id: null,
    workspace_id: "workspace-a",
    title: "Current project",
    created_at: 1,
    updated_at: 2,
    selected_knowledge_base_ids_json: null,
    snapshot_json: null,
  },
]
const queries: string[] = []

const sql: SqlAdapter = {
  async select<T extends object>(query: string): Promise<T[]> {
    queries.push(query)
    return rows as T[]
  },
  execute: vi.fn(async () => ({ rowsAffected: 0 })),
}

describe("SqliteChatStore conversation lists", () => {
  it("loads every workspace ordered by recent activity", async () => {
    const store = new SqliteChatStore(sql, async () => undefined)

    const conversations = await store.getAllConversations()

    expect(queries[0]).toContain("ORDER BY c.updated_at DESC")
    expect(queries[0]).not.toContain("WHERE s.workspace_id")
    expect(conversations.map(conversation => conversation.workspaceId)).toEqual([
      "workspace-b",
      "workspace-a",
    ])
  })
})
