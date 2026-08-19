import { exists, stat } from "@tauri-apps/plugin-fs"

export interface FileRevision {
  size: number
  mtime: number
}

export const FILE_CONFLICT_KIND = {
  MODIFIED: "modified",
  MISSING: "missing",
} as const

export type FileConflictKind = (typeof FILE_CONFLICT_KIND)[keyof typeof FILE_CONFLICT_KIND]

export class FileConflictError extends Error {
  readonly path: string
  readonly kind: FileConflictKind
  readonly expected: FileRevision | null
  readonly actual: FileRevision | null

  constructor(
    path: string,
    kind: FileConflictKind,
    expected: FileRevision | null,
    actual: FileRevision | null
  ) {
    super(kind === FILE_CONFLICT_KIND.MISSING ? "file is missing" : "file changed on disk")
    this.name = "FileConflictError"
    this.path = path
    this.kind = kind
    this.expected = expected
    this.actual = actual
  }
}

function mtimeMilliseconds(value: Date | string | null): number {
  if (!value) return 0
  return new Date(value).getTime()
}

export async function readFileRevision(path: string): Promise<FileRevision | null> {
  if (!(await exists(path))) return null
  const info = await stat(path)
  return { size: info.size, mtime: mtimeMilliseconds(info.mtime) }
}

export function revisionsEqual(left: FileRevision | null, right: FileRevision | null): boolean {
  return left?.size === right?.size && left?.mtime === right?.mtime
}

export async function assertFileRevision(
  path: string,
  expected: FileRevision | null
): Promise<void> {
  const actual = await readFileRevision(path)
  if (!actual) {
    throw new FileConflictError(path, FILE_CONFLICT_KIND.MISSING, expected, null)
  }
  if (!expected || !revisionsEqual(expected, actual)) {
    throw new FileConflictError(path, FILE_CONFLICT_KIND.MODIFIED, expected, actual)
  }
}
