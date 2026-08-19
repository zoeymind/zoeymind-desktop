import { beforeEach, describe, expect, it, vi } from "vitest"

const fs = vi.hoisted(() => ({ exists: vi.fn(), mkdir: vi.fn() }))
const paths = vi.hoisted(() => ({
  join: vi.fn(async (directory: string, filename: string) => `${directory}/${filename}`),
}))
const recovery = vi.hoisted(() => ({
  clearRecovery: vi.fn(),
  readRecoveryBundle: vi.fn(),
}))
const projects = vi.hoisted(() => ({
  findByPath: vi.fn(),
  refreshProjectIndex: vi.fn(),
  registerProject: vi.fn(),
}))
const revisions = vi.hoisted(() => ({
  readFileRevision: vi.fn(),
  revisionsEqual: vi.fn(),
}))
const bundles = vi.hoisted(() => ({ writeBundle: vi.fn() }))
const tabs = vi.hoisted(() => ({ openTab: vi.fn(), setActive: vi.fn() }))

vi.mock("@tauri-apps/plugin-fs", () => fs)
vi.mock("@tauri-apps/api/path", () => paths)
vi.mock("./recovery", () => recovery)
vi.mock("./projects-repo", () => projects)
vi.mock("./file-revision", () => revisions)
vi.mock("./zmind-file", () => bundles)
vi.mock("./paths", () => ({ defaultVaultDir: vi.fn(async () => "/vault") }))
vi.mock("@/shared/app-shared", () => ({ createUUID: vi.fn(() => "new-project") }))
vi.mock("@/shared/tabs/store", () => ({ useTabs: { getState: () => tabs } }))

import { restoreAllRecoveries } from "./recovery-service"

const bundle = {
  tree: { data: { text: "Recovered" }, children: [] },
  meta: { name: "Recovered", tags: [], createdAt: 1, updatedAt: 2, nodeCount: 1 },
}

function descriptor(projectId: string, savedAt: number) {
  return {
    projectId,
    sourcePath: `/vault/${projectId}.zmind`,
    sourceRevision: { size: 10, mtime: 20 },
    savedAt,
    name: projectId,
  }
}

describe("restoreAllRecoveries", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    recovery.readRecoveryBundle.mockResolvedValue(bundle)
    recovery.clearRecovery.mockResolvedValue(undefined)
    fs.exists.mockResolvedValue(true)
    projects.findByPath.mockResolvedValue({ id: "existing" })
    revisions.readFileRevision.mockResolvedValue({ size: 10, mtime: 20 })
    revisions.revisionsEqual.mockReturnValue(true)
  })

  it("restores oldest first and clears only fully successful records", async () => {
    bundles.writeBundle
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("disk full"))

    const result = await restoreAllRecoveries([descriptor("newer", 2), descriptor("older", 1)])

    expect(bundles.writeBundle.mock.calls.map(call => call[0])).toEqual([
      "/vault/older.zmind",
      "/vault/newer.zmind",
    ])
    expect(recovery.clearRecovery).toHaveBeenCalledTimes(1)
    expect(recovery.clearRecovery).toHaveBeenCalledWith("older")
    expect(result.succeeded).toHaveLength(1)
    expect(result.failed).toEqual([{ recoveryId: "newer", message: "disk full" }])
    expect(tabs.setActive).toHaveBeenCalledWith("existing")
  })

  it("preserves a changed source and creates a unique recovery copy", async () => {
    revisions.revisionsEqual.mockReturnValue(false)
    projects.findByPath.mockResolvedValue(null)
    fs.exists.mockImplementation(async (path: string) => path.endsWith("source.zmind"))
    bundles.writeBundle.mockResolvedValue(undefined)

    const result = await restoreAllRecoveries([
      {
        ...descriptor("source", 1),
        name: "Plan",
      },
    ])

    expect(bundles.writeBundle).toHaveBeenCalledWith("/vault/Plan-恢复.zmind", bundle)
    expect(projects.registerProject).toHaveBeenCalledWith(
      expect.objectContaining({ id: "new-project", path: "/vault/Plan-恢复.zmind" })
    )
    expect(result.failed).toEqual([])
  })
})
