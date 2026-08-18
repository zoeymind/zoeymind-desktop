/**
 * SqlMcpRepo —— MCP servers 配置存 app.db 的 mcp_servers 表。
 *
 * 桌面端不再走后端 tRPC 加密入库；本地存明文 JSON 配置（用户接受，见 models.json 决策）。
 *
 * 运行时 spawn / 协议客户端：本 repo 只管配置 CRUD；实际拉起 MCP server 进程
 * 由 tauri-plugin-shell 的 Command 完成（后续 wire-up）。
 */
import { select, execute } from './db'

export interface McpServerRow {
  id: string
  name: string
  kind: 'stdio' | 'sse' | 'http'
  command: string | null
  args: string[]
  url: string | null
  headers: Record<string, string>
  preset: string | null
  isEnabled: boolean
  createdAt: number
  updatedAt: number
}

interface RawMcpRow {
  id: string
  name: string
  kind: string
  command: string | null
  args_json: string
  url: string | null
  headers_json: string
  preset: string | null
  is_enabled: number
  created_at: number
  updated_at: number
}

function safeParseObject(raw: string): Record<string, string> {
  try {
    const parsed: unknown = JSON.parse(raw)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, string>
    }
    return {}
  } catch {
    return {}
  }
}

function safeParseArray(raw: string): string[] {
  try {
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : []
  } catch {
    return []
  }
}

function toRow(row: RawMcpRow): McpServerRow {
  const kind = row.kind === 'sse' || row.kind === 'http' ? row.kind : 'stdio'
  return {
    id: row.id,
    name: row.name,
    kind,
    command: row.command,
    args: safeParseArray(row.args_json),
    url: row.url,
    headers: safeParseObject(row.headers_json),
    preset: row.preset,
    isEnabled: row.is_enabled === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

export async function listMcpServers(): Promise<McpServerRow[]> {
  const rows = await select<RawMcpRow>(`SELECT * FROM mcp_servers ORDER BY created_at ASC`)
  return rows.map(toRow)
}

export interface UpsertMcpServer {
  id: string
  name: string
  kind: 'stdio' | 'sse' | 'http'
  command?: string | null
  args?: string[]
  url?: string | null
  headers?: Record<string, string>
  preset?: string | null
  isEnabled?: boolean
}

export async function createMcpServer(input: UpsertMcpServer): Promise<void> {
  const now = Date.now()
  await execute(
    `INSERT INTO mcp_servers
       (id, name, kind, command, args_json, url, headers_json, preset, is_enabled, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10)`,
    [
      input.id,
      input.name,
      input.kind,
      input.command ?? null,
      JSON.stringify(input.args ?? []),
      input.url ?? null,
      JSON.stringify(input.headers ?? {}),
      input.preset ?? null,
      input.isEnabled === false ? 0 : 1,
      now
    ]
  )
}

export async function updateMcpServer(id: string, patch: Partial<UpsertMcpServer>): Promise<void> {
  const existing = (await select<RawMcpRow>(`SELECT * FROM mcp_servers WHERE id = $1`, [id]))[0]
  if (!existing) return
  const merged: UpsertMcpServer = {
    id,
    name: patch.name ?? existing.name,
    kind: patch.kind ?? (existing.kind as UpsertMcpServer['kind']),
    command: patch.command ?? existing.command,
    args: patch.args ?? safeParseArray(existing.args_json),
    url: patch.url ?? existing.url,
    headers: patch.headers ?? safeParseObject(existing.headers_json),
    preset: patch.preset ?? existing.preset,
    isEnabled: patch.isEnabled ?? existing.is_enabled === 1
  }
  await execute(
    `UPDATE mcp_servers
       SET name = $1, kind = $2, command = $3, args_json = $4, url = $5,
           headers_json = $6, preset = $7, is_enabled = $8, updated_at = $9
     WHERE id = $10`,
    [
      merged.name,
      merged.kind,
      merged.command ?? null,
      JSON.stringify(merged.args ?? []),
      merged.url ?? null,
      JSON.stringify(merged.headers ?? {}),
      merged.preset ?? null,
      merged.isEnabled === false ? 0 : 1,
      Date.now(),
      id
    ]
  )
}

export async function deleteMcpServer(id: string): Promise<void> {
  await execute(`DELETE FROM mcp_servers WHERE id = $1`, [id])
}

export async function toggleMcpServer(id: string, enabled: boolean): Promise<void> {
  await execute(
    `UPDATE mcp_servers SET is_enabled = $1, updated_at = $2 WHERE id = $3`,
    [enabled ? 1 : 0, Date.now(), id]
  )
}
