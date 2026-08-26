// @vitest-environment jsdom
import "fake-indexeddb/auto"
import { IDBFactory } from "fake-indexeddb"
import { openDB } from "idb"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { Conversation, SqlAdapter, SqliteChatStore } from "./sqliteChatStore"
import { migrateIndexedDbToSqlite } from "./indexedDbToSqliteMigration"

const LEGACY_DATABASE = "zoey-chat-v2"

async function legacyDatabaseExists(): Promise<boolean> {
  return (await indexedDB.databases()).some(database => database.name === LEGACY_DATABASE)
}

async function seedLegacyConversation(): Promise<void> {
  const database = await openDB(LEGACY_DATABASE, 1, {
    upgrade(db) {
      db.createObjectStore("conversations", { keyPath: "id" })
      db.createObjectStore("messages", { keyPath: "id" })
    },
  })
  await database.put("conversations", {
    id: "conversation",
    workspaceId: "workspace",
    title: "Legacy chat",
    createdAt: 1,
    updatedAt: 2,
  } satisfies Conversation)
  await database.put("messages", {
    id: "message",
    conversationId: "conversation",
    timestamp: 3,
    role: "user",
    parts: [{ type: "text", text: "hello" }],
  })
  database.close()
}

function migrationSql(): SqlAdapter & { completed: boolean } {
  return {
    completed: false,
    async select<T extends object>() {
      return (this.completed ? [{ migration_key: "indexeddb-chat-v1" }] : []) as T[]
    },
    async execute() {
      this.completed = true
      return { rowsAffected: 1 }
    },
  }
}

beforeEach(() => {
  Object.defineProperty(globalThis, "indexedDB", {
    configurable: true,
    value: new IDBFactory(),
  })
})

describe("legacy IndexedDB chat migration", () => {
  it("keeps the source database and marker unset when an import fails", async () => {
    await seedLegacyConversation()
    const sql = migrationSql()
    const service = {
      importConversation: vi.fn().mockRejectedValue(new Error("sqlite write failed")),
    } as unknown as SqliteChatStore

    await expect(migrateIndexedDbToSqlite(service, sql)).rejects.toThrow("sqlite write failed")

    expect(sql.completed).toBe(false)
    expect(await legacyDatabaseExists()).toBe(true)
  })

  it("marks completion before deleting the source and skips future imports", async () => {
    await seedLegacyConversation()
    const sql = migrationSql()
    const importConversation = vi.fn().mockResolvedValue(undefined)
    const service = { importConversation } as unknown as SqliteChatStore

    await migrateIndexedDbToSqlite(service, sql)

    expect(sql.completed).toBe(true)
    expect(importConversation).toHaveBeenCalledOnce()
    expect(await legacyDatabaseExists()).toBe(false)

    await migrateIndexedDbToSqlite(service, sql)
    expect(importConversation).toHaveBeenCalledOnce()
  })
})
