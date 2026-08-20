import { beforeEach, describe, expect, it, vi } from "vitest"

const database = new Map<string, string>()
const db = vi.hoisted(() => ({
  select: vi.fn(async () => [...database].map(([key, value_json]) => ({ key, value_json }))),
  execute: vi.fn(async (sql: string, args: unknown[] = []) => {
    if (sql.startsWith("INSERT INTO app_kv")) database.set(String(args[0]), String(args[1]))
    if (sql.startsWith("DELETE FROM app_kv WHERE")) database.delete(String(args[0]))
    return { rowsAffected: 1 }
  }),
}))

vi.mock("./db", () => db)

import {
  getPreference,
  initializePreferences,
  removePreference,
  setPreference,
} from "./preferences"

beforeEach(() => {
  database.clear()
  db.select.mockClear()
  db.execute.mockClear()
})

describe("SQLite preferences", () => {
  it("hydrates synchronous reads from app_kv before render", async () => {
    database.set("theme", JSON.stringify("dark"))
    await initializePreferences()
    expect(getPreference("theme")).toBe("dark")
  })

  it("writes and removes values through app_kv", async () => {
    await initializePreferences()
    setPreference("model", "local")
    expect(getPreference("model")).toBe("local")
    await vi.waitFor(() => expect(database.get("model")).toBe(JSON.stringify("local")))
    removePreference("model")
    expect(getPreference("model")).toBeNull()
    await vi.waitFor(() => expect(database.has("model")).toBe(false))
  })
})
