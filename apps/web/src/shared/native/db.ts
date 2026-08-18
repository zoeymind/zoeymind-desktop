/**
 * app.db —— SQLite 单一持久层。所有元数据（项目索引、文件夹、快照、
 * chat 会话/消息、AI memory、MCP servers、KV 偏好）都住这。
 *
 * Migrations 在 Rust 侧 lib.rs 声明（tauri-plugin-sql `add_migrations`），
 * 首次 load 时自动 up。前端只做 select/execute，schema 不在这里维护。
 */
import Database from '@tauri-apps/plugin-sql'

const DB_URL = 'sqlite:app.db'

let dbPromise: Promise<Database> | null = null

export function getDB(): Promise<Database> {
  if (!dbPromise) {
    dbPromise = Database.load(DB_URL)
  }
  return dbPromise
}

/** 关闭当前连接（测试或热重载用）。 */
export async function closeDB(): Promise<void> {
  if (!dbPromise) return
  const db = await dbPromise
  await db.close()
  dbPromise = null
}

export type Row = Record<string, unknown>

export async function select<T extends Row = Row>(sql: string, args: unknown[] = []): Promise<T[]> {
  const db = await getDB()
  return db.select<T[]>(sql, args)
}

export async function execute(
  sql: string,
  args: unknown[] = []
): Promise<{ rowsAffected: number; lastInsertId?: number }> {
  const db = await getDB()
  const res = await db.execute(sql, args)
  return { rowsAffected: res.rowsAffected, lastInsertId: res.lastInsertId }
}
