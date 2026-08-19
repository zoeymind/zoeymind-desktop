import { beforeEach, describe, expect, it, vi } from "vitest"

const fs = vi.hoisted(() => ({ exists: vi.fn(), stat: vi.fn() }))
vi.mock("@tauri-apps/plugin-fs", () => fs)

import {
  assertFileRevision,
  FILE_CONFLICT_KIND,
  readFileRevision,
  revisionsEqual,
} from "./file-revision"

describe("file revision guard", () => {
  beforeEach(() => vi.clearAllMocks())

  it("accepts the same size and modification time", async () => {
    fs.exists.mockResolvedValue(true)
    fs.stat.mockResolvedValue({ size: 42, mtime: new Date(1234) })
    const revision = await readFileRevision("/vault/a.zmind")

    expect(revisionsEqual(revision, { size: 42, mtime: 1234 })).toBe(true)
    await expect(assertFileRevision("/vault/a.zmind", revision)).resolves.toBeUndefined()
  })

  it("blocks a save after the disk file changed", async () => {
    fs.exists.mockResolvedValue(true)
    fs.stat.mockResolvedValue({ size: 43, mtime: new Date(2000) })

    await expect(
      assertFileRevision("/vault/a.zmind", { size: 42, mtime: 1234 })
    ).rejects.toMatchObject({ kind: FILE_CONFLICT_KIND.MODIFIED })
  })

  it("blocks a save after the disk file disappeared", async () => {
    fs.exists.mockResolvedValue(false)

    await expect(
      assertFileRevision("/vault/a.zmind", { size: 42, mtime: 1234 })
    ).rejects.toMatchObject({ kind: FILE_CONFLICT_KIND.MISSING })
  })
})
