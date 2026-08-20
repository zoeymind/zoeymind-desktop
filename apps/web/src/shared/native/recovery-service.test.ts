import { beforeEach, describe, expect, it, vi } from "vitest"

const recovery = vi.hoisted(() => ({
  clearRecovery: vi.fn(),
  readRecoveryBundle: vi.fn(),
}))
const pending = vi.hoisted(() => ({ stashRecovered: vi.fn() }))
const tabs = vi.hoisted(() => ({ openTab: vi.fn(), setActive: vi.fn() }))

vi.mock("./recovery", () => recovery)
vi.mock("./pending-projects", () => ({ stashRecovered: pending.stashRecovered }))
vi.mock("@/shared/tabs/store", () => ({ useTabs: { getState: () => tabs } }))

import { restoreAllRecoveries } from "./recovery-service"

const bundle = {
  tree: { data: { text: "Recovered" }, children: [] },
  meta: { name: "Recovered", tags: [], createdAt: 1, updatedAt: 2, nodeCount: 1 },
}

function descriptor(projectId: string, savedAt: number, sourcePath: string | null = null) {
  return {
    projectId,
    sourcePath,
    sourceRevision: sourcePath ? { size: 10, mtime: 20 } : null,
    savedAt,
    name: projectId,
  }
}

describe("restoreAllRecoveries", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    recovery.readRecoveryBundle.mockResolvedValue(bundle)
    pending.stashRecovered.mockImplementation(
      ({ recoveryId }: { recoveryId: string }) => `unsaved-recovery-${recoveryId}`
    )
  })

  it("opens recoveries oldest first as unsaved dirty documents without consuming backups", async () => {
    const result = await restoreAllRecoveries([
      descriptor("newer", 2, "/documents/newer.zmind"),
      descriptor("older", 1),
    ])

    expect(pending.stashRecovered.mock.calls.map(call => call[0])).toEqual([
      {
        title: "Recovered",
        tree: bundle.tree,
        recoveryId: "older",
        originPath: null,
        originRevision: null,
      },
      {
        title: "Recovered",
        tree: bundle.tree,
        recoveryId: "newer",
        originPath: "/documents/newer.zmind",
        originRevision: { size: 10, mtime: 20 },
      },
    ])
    expect(tabs.openTab).toHaveBeenNthCalledWith(1, {
      id: "unsaved-recovery-older",
      kind: "recovery",
      title: "Recovered",
    })
    expect(tabs.openTab).toHaveBeenNthCalledWith(2, {
      id: "unsaved-recovery-newer",
      kind: "recovery",
      title: "Recovered",
    })
    expect(tabs.setActive).toHaveBeenCalledWith("unsaved-recovery-newer")
    expect(recovery.clearRecovery).not.toHaveBeenCalled()
    expect(result.failed).toEqual([])
  })

  it("keeps a failed recovery available and continues restoring the remaining records", async () => {
    recovery.readRecoveryBundle.mockResolvedValueOnce(null).mockResolvedValueOnce(bundle)

    const result = await restoreAllRecoveries([descriptor("missing", 1), descriptor("valid", 2)])

    expect(result.failed).toEqual([{ recoveryId: "missing", message: "恢复文件不存在" }])
    expect(tabs.openTab).toHaveBeenCalledOnce()
    expect(recovery.clearRecovery).not.toHaveBeenCalled()
  })
})
