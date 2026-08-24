import type { ProjectRow } from "@/shared/native"

export interface LocalProject {
  id: string
  name: string
  path: string
  folderId: string | null
  updatedAt: Date
  createdAt: Date
  exists: boolean
  isArchived: boolean
  isStarred: boolean
  tags: string[]
  nodeCount: number
  size: number
}

/** `/a/b/foo.zmind` -> `foo`; unsaved drafts use `Untitled`. */
function fileBasenameNoExt(path: string): string {
  if (!path) return "Untitled"
  const last = path.split(/[\\/]/).pop() ?? ""
  return last.replace(/\.zmind$/i, "") || "Untitled"
}

export function toLocalProject(row: ProjectRow): LocalProject {
  return {
    id: row.id,
    name: fileBasenameNoExt(row.path),
    path: row.path,
    folderId: row.folderId,
    updatedAt: new Date(row.updatedAt),
    createdAt: new Date(row.createdAt),
    exists: row.exists,
    isArchived: row.isArchived,
    isStarred: row.isStarred,
    tags: row.tags,
    nodeCount: row.nodeCount,
    size: row.size,
  }
}
