/**
 * SqlFolderRepo —— app.db 里 folders 表的 CRUD。
 *
 * 文件夹在桌面端是"虚拟标签"：不映射真实目录，只在 projects_index.folder_id
 * 里作为可空外键存在，用户在 Finder 里看不到文件夹结构。
 */
import { select, execute } from './db'

export interface FolderRow {
  id: string
  name: string
  sortOrder: number
  createdAt: number
  mindmapCount: number
}

interface RawFolderRow {
  id: string
  name: string
  sort_order: number
  created_at: number
  mindmap_count: number
}

function toFolder(row: RawFolderRow): FolderRow {
  return {
    id: row.id,
    name: row.name,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    mindmapCount: row.mindmap_count
  }
}

export async function listFolders(): Promise<FolderRow[]> {
  const rows = await select<RawFolderRow>(
    `SELECT f.id, f.name, f.sort_order, f.created_at,
            (SELECT COUNT(*) FROM projects_index p WHERE p.folder_id = f.id) AS mindmap_count
     FROM folders f
     ORDER BY f.sort_order ASC, f.created_at ASC`
  )
  return rows.map(toFolder)
}

export async function createFolder(id: string, name: string, sortOrder: number): Promise<void> {
  await execute(
    `INSERT INTO folders (id, name, sort_order, created_at) VALUES ($1, $2, $3, $4)`,
    [id, name, sortOrder, Date.now()]
  )
}

export async function renameFolder(id: string, name: string): Promise<void> {
  await execute(`UPDATE folders SET name = $1 WHERE id = $2`, [name, id])
}

/**
 * 删文件夹。`deleteContents=false`：把归属该 folder 的 projects 的 folder_id 置 null（SQL 会级联做，
 * 因为 schema 是 ON DELETE SET NULL）。`deleteContents=true`：先把归属该 folder 的 projects
 * 从索引里删除（磁盘 .zmind 不动，只是从库里摘掉；用户在 Finder 里还有原文件）。
 */
export async function deleteFolder(id: string, deleteContents: boolean): Promise<void> {
  if (deleteContents) {
    await execute(`DELETE FROM projects_index WHERE folder_id = $1`, [id])
  }
  await execute(`DELETE FROM folders WHERE id = $1`, [id])
}
