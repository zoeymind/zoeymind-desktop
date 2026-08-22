import { describe, expect, it, vi } from "vitest"
import type { BundleSource } from "./save-flow"
import { executeSaveTransaction, type SaveParticipant, type SavePhase } from "./save-transaction"

function source(): BundleSource {
  return {
    name: "test",
    tree: { data: { uid: "root", text: "root" }, children: [] },
  }
}

describe("executeSaveTransaction", () => {
  it("commits editor state only after persistence succeeds", async () => {
    const order: string[] = []
    const phases: SavePhase[] = []
    const participant: SaveParticipant = {
      prepare: prepared => {
        order.push("prepare")
        prepared.tree.data.text = "persisted"
        return {
          source: prepared,
          commit: () => {
            order.push("commit")
          },
        }
      },
    }

    const result = await executeSaveTransaction({
      source: source(),
      participants: [participant],
      persist: async prepared => {
        order.push(`persist:${String(prepared.tree.data.text)}`)
        return "saved"
      },
      commit: true,
      onCommit: () => order.push("dirty-clean"),
      isCurrent: () => true,
      onPhase: phase => phases.push(phase),
    })

    expect(order).toEqual(["prepare", "persist:persisted", "commit", "dirty-clean"])
    expect(phases).toEqual(["preparing", "persisting", "committing", "idle"])
    expect(result).toEqual({ value: "saved", liveStateMatchesPersisted: true })
  })

  it("does not commit or mutate the caller source when persistence fails", async () => {
    const original = source()
    const commit = vi.fn()
    const phases: SavePhase[] = []
    const participant: SaveParticipant = {
      prepare: prepared => {
        prepared.tree.data.text = "prepared-only"
        return { source: prepared, commit }
      },
    }

    await expect(
      executeSaveTransaction({
        source: original,
        participants: [participant],
        persist: async () => {
          throw new Error("disk full")
        },
        commit: true,
        onCommit: () => undefined,
        isCurrent: () => true,
        onPhase: phase => phases.push(phase),
      })
    ).rejects.toThrow("disk full")

    expect(commit).not.toHaveBeenCalled()
    expect(original.tree.data.text).toBe("root")
    expect(phases).toEqual(["preparing", "persisting", "failed"])
  })

  it("prepares a save-copy snapshot without committing the current editor", async () => {
    const commit = vi.fn()

    const result = await executeSaveTransaction({
      source: source(),
      participants: [{ prepare: prepared => ({ source: prepared, commit }) }],
      persist: async () => undefined,
      commit: false,
      onCommit: () => undefined,
      isCurrent: () => true,
      onPhase: () => undefined,
    })

    expect(commit).not.toHaveBeenCalled()
    expect(result.liveStateMatchesPersisted).toBe(true)
  })

  it("rejects success and does not commit when editing continues during the save", async () => {
    const commit = vi.fn()

    await expect(
      executeSaveTransaction({
        source: source(),
        participants: [{ prepare: prepared => ({ source: prepared, commit }) }],
        persist: async () => undefined,
        commit: true,
        onCommit: () => undefined,
        isCurrent: () => false,
        onPhase: () => undefined,
      })
    ).rejects.toThrow("保存期间有新修改")

    expect(commit).not.toHaveBeenCalled()
  })
})
