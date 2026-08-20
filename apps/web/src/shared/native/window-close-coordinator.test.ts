import { describe, expect, it, vi } from "vitest"
import { createProjectSessionStore } from "@/products/mind/editor-session/project-session-store"
import {
  discardAllSessions,
  guardedSessions,
  prepareForAppRestart,
  saveAllSessions,
} from "./window-close-coordinator"

describe("window close coordinator", () => {
  it("selects every dirty session exactly once", () => {
    const clean = createProjectSessionStore("clean")
    const first = createProjectSessionStore("first")
    const second = createProjectSessionStore("second")
    first.getState().setDirty(true)
    second.getState().setDirty(true)

    expect(
      guardedSessions([clean, first, second]).map(store => store.getState().projectId)
    ).toEqual(["first", "second"])
  })

  it("saves sessions sequentially and stops on the first failure", async () => {
    const first = createProjectSessionStore("first")
    const second = createProjectSessionStore("second")
    const firstSave = vi.fn(async () => undefined)
    const secondSave = vi.fn(async () => {
      throw new Error("disk full")
    })
    first.getState().setCommands({ save: firstSave })
    second.getState().setCommands({ save: secondSave })

    await expect(saveAllSessions([first, second])).rejects.toThrow("disk full")
    expect(firstSave).toHaveBeenCalledOnce()
    expect(secondSave).toHaveBeenCalledOnce()
  })

  it("discards every selected session", async () => {
    const first = createProjectSessionStore("first")
    const second = createProjectSessionStore("second")
    const discardFirst = vi.fn(async () => undefined)
    const discardSecond = vi.fn(async () => undefined)
    first.getState().setCommands({ discard: discardFirst })
    second.getState().setCommands({ discard: discardSecond })

    await discardAllSessions([first, second])
    expect(discardFirst).toHaveBeenCalledOnce()
    expect(discardSecond).toHaveBeenCalledOnce()
  })

  it("persists every guarded session before an app restart", async () => {
    const session = createProjectSessionStore("update-project")
    const save = vi.fn(async () => session.getState().setDirty(false))
    const flushRecovery = vi.fn(async () => undefined)
    session.getState().setDirty(true)
    session.getState().setCommands({ save, flushRecovery })

    await prepareForAppRestart([session])

    expect(save).toHaveBeenCalledOnce()
    expect(flushRecovery).toHaveBeenCalledOnce()
    expect(session.getState().dirty).toBe(false)
  })
})
