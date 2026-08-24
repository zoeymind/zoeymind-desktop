/**
 * SqlProjectRepo —— app.db 里 projects_index 表的 CRUD + fs 存在性校验。
 *
 * 每条记录对应磁盘上一个 .zmind 文件（path 是绝对路径 UNIQUE 键）。
 * `list()` 会顺带 stat 每条记录的 path，返回值里带 `exists` 标志；
 * UI 卡片对 `!exists` 走"失效卡片"渲染（灰边 + 无预览 + 修复引导）。
 *
 * 注意：这里只做索引 CRUD；.zmind 文件本身的读写在 `zmind-file.ts`；
 * 保存流程（更新 mtime/size/nodeCount/preview 缓存）由 editor 层协调。
 */
import { exists, rename, stat } from "@tauri-apps/plugin-fs"
import { select, execute } from "./db"

export interface ProjectRow {
  id: string
  path: string
  name: string
  folderId: string | null
  isStarred: boolean
  isArchived: boolean
  tags: string[]
  nodeCount: number
  size: number
  mtime: number | null
  createdAt: number
  updatedAt: number
  lastOpenedAt: number | null
  exists: boolean
}

interface RawProjectRow {
  id: string
  path: string
  name: string
  folder_id: string | null
  is_starred: number
  is_archived: number
  tags_json: string
  node_count: number
  size: number
  mtime: number | null
  created_at: number
  updated_at: number
  last_opened_at: number | null
}

function toProject(row: RawProjectRow, existsOnDisk: boolean): ProjectRow {
  return {
    id: row.id,
    path: row.path,
    name: row.name,
    folderId: row.folder_id,
    isStarred: row.is_starred === 1,
    isArchived: row.is_archived === 1,
    tags: safeParseArray(row.tags_json),
    nodeCount: row.node_count,
    size: row.size,
    mtime: row.mtime,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastOpenedAt: row.last_opened_at,
    exists: existsOnDisk,
  }
}

function safeParseArray(raw: string): string[] {
  try {
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : []
  } catch {
    return []
  }
}

export interface ListProjectsOptions {
  folderId?: string | null // undefined = 全部；null = 无 folder；string = 归属该 folder
  includeArchived?: boolean
}

export async function listProjects(opts: ListProjectsOptions = {}): Promise<ProjectRow[]> {
  const where: string[] = []
  const args: unknown[] = []
  if (opts.folderId === null) {
    where.push("folder_id IS NULL")
  } else if (typeof opts.folderId === "string") {
    where.push(`folder_id = $${args.length + 1}`)
    args.push(opts.folderId)
  }
  if (!opts.includeArchived) {
    where.push("is_archived = 0")
  }
  const sql =
    `SELECT * FROM projects_index` +
    (where.length ? ` WHERE ${where.join(" AND ")}` : "") +
    ` ORDER BY updated_at DESC`
  const rows = await select<RawProjectRow>(sql, args)
  const results: ProjectRow[] = []
  for (const row of rows) {
    const existsOnDisk = await exists(row.path)
    results.push(toProject(row, existsOnDisk))
  }
  return results
}

export async function getProject(id: string): Promise<ProjectRow | null> {
  const rows = await select<RawProjectRow>(`SELECT * FROM projects_index WHERE id = $1`, [id])
  if (rows.length === 0) return null
  const row = rows[0]
  return toProject(row, await exists(row.path))
}

export interface RegisterProjectInput {
  id: string
  path: string
  name: string
  folderId?: string | null
  nodeCount?: number
}

/** 新建/首次打开 .zmind → 落索引。path 冲突时抛错（UI 层应先弹覆盖确认）。 */
export async function registerProject(input: RegisterProjectInput): Promise<void> {
  const info = await stat(input.path).catch(() => null)
  const size = info?.size ?? 0
  const mtime = info?.mtime ? new Date(info.mtime).getTime() : Date.now()
  const now = Date.now()
  await execute(
    `INSERT INTO projects_index
       (id, path, name, folder_id, node_count, size, mtime, created_at, updated_at, last_opened_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8, NULL)`,
    [
      input.id,
      input.path,
      input.name,
      input.folderId ?? null,
      input.nodeCount ?? 0,
      size,
      mtime,
      now,
    ]
  )
}

/** 保存后回写 index：更新 name/nodeCount/size/mtime。 */
export async function refreshProjectIndex(
  id: string,
  patch: { name?: string; nodeCount?: number; folderId?: string | null }
): Promise<void> {
  const row = await getProject(id)
  if (!row) return
  const info = await stat(row.path).catch(() => null)
  const size = info?.size ?? row.size
  const mtime = info?.mtime ? new Date(info.mtime).getTime() : Date.now()
  const now = Date.now()
  await execute(
    `UPDATE projects_index
       SET name = COALESCE($1, name),
           node_count = COALESCE($2, node_count),
           folder_id = CASE WHEN $3 = 'y' THEN $4 ELSE folder_id END,
           size = $5,
           mtime = $6,
           updated_at = $7
     WHERE id = $8`,
    [
      patch.name ?? null,
      patch.nodeCount ?? null,
      patch.folderId !== undefined ? "y" : "n",
      patch.folderId ?? null,
      size,
      mtime,
      now,
      id,
    ]
  )
}

export interface RenamedProjectFile {
  path: string
  name: string
}

function sanitizeProjectFilename(name: string): string {
  const sanitized = name.replace(/[\\/:*?"<>|]/g, "_").trim()
  return sanitized || "Untitled"
}

/** 重命名项目及其磁盘 .zmind 文件；文件路径与索引始终一起更新。 */
export async function renameProjectFile(
  id: string,
  requestedName: string
): Promise<RenamedProjectFile> {
  const row = await getProject(id)
  if (!row) throw new Error("项目不存在")

  const name = sanitizeProjectFilename(requestedName)
  const separatorIndex = Math.max(row.path.lastIndexOf("/"), row.path.lastIndexOf("\\"))
  const directory = separatorIndex >= 0 ? row.path.slice(0, separatorIndex) : ""
  const separator = row.path.includes("\\") && !row.path.includes("/") ? "\\" : "/"
  const path = `${directory}${directory ? separator : ""}${name}.zmind`

  if (path === row.path) return { path, name }
  if (await exists(path)) throw new Error(`已存在同名文件“${name}.zmind”`)

  await rename(row.path, path)
  try {
    await execute(
      `UPDATE projects_index
         SET path = $1, name = $2, updated_at = $3
       WHERE id = $4`,
      [path, name, Date.now(), id]
    )
  } catch (error) {
    await rename(path, row.path).catch(() => undefined)
    throw error
  }

  return { path, name }
}

export async function relinkProjectFile(id: string, path: string): Promise<RenamedProjectFile> {
  const row = await getProject(id)
  if (!row) throw new Error("项目不存在")
  if (!(await exists(path))) throw new Error("选择的文件不存在")
  const occupied = await findByPath(path)
  if (occupied && occupied.id !== id) throw new Error("该文件已属于另一个项目")
  const name = path.replace(/^.*[\\/]/, "").replace(/\.zmind$/i, "") || row.name
  const info = await stat(path)
  await execute(
    `UPDATE projects_index
       SET path = $1, name = $2, size = $3, mtime = $4, updated_at = $5
     WHERE id = $6`,
    [
      path,
      name,
      info.size,
      info.mtime ? new Date(info.mtime).getTime() : Date.now(),
      Date.now(),
      id,
    ]
  )
  return { path, name }
}

export async function setStarred(id: string, starred: boolean): Promise<void> {
  await execute(`UPDATE projects_index SET is_starred = $1 WHERE id = $2`, [starred ? 1 : 0, id])
}

export async function setArchived(id: string, archived: boolean): Promise<void> {
  await execute(`UPDATE projects_index SET is_archived = $1 WHERE id = $2`, [archived ? 1 : 0, id])
}

export async function touchLastOpened(id: string): Promise<void> {
  await execute(`UPDATE projects_index SET last_opened_at = $1 WHERE id = $2`, [Date.now(), id])
}

/** 文件夹是虚拟分类；移动只更新 folder_id，不改变用户磁盘上的文件路径。 */
export async function moveProjectToFolder(id: string, folderId: string | null): Promise<void> {
  const row = await getProject(id)
  if (!row || row.folderId === folderId) return
  await execute(`UPDATE projects_index SET folder_id = $1, updated_at = $2 WHERE id = $3`, [
    folderId,
    Date.now(),
    id,
  ])
}

/** 从索引里删记录；不删磁盘 .zmind 文件（用户可能想留着自己管理）。 */
export async function unregisterProject(id: string): Promise<void> {
  await execute(`DELETE FROM projects_index WHERE id = $1`, [id])
}

/** 找同 path 的记录（Save As 覆盖场景用来 upsert 或提示）。 */
export async function findByPath(path: string): Promise<ProjectRow | null> {
  const rows = await select<RawProjectRow>(`SELECT * FROM projects_index WHERE path = $1`, [path])
  if (rows.length === 0) return null
  const row = rows[0]
  return toProject(row, await exists(row.path))
}
