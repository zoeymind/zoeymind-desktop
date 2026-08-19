import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  enqueueRecoveryWrite,
  flushRecoveryWrites,
  resetRecoveryQueueForTests,
} from "./recovery-queue"

describe("recovery write queue", () => {
  beforeEach(() => resetRecoveryQueueForTests())

  it("runs one write at a time and coalesces queued snapshots to the newest one", async () => {
    let releaseFirst: (() => void) | undefined
    const first = vi.fn(
      () =>
        new Promise<void>(resolve => {
          releaseFirst = resolve
        })
    )
    const stale = vi.fn(async () => undefined)
    const newest = vi.fn(async () => undefined)

    enqueueRecoveryWrite("project-1", first)
    enqueueRecoveryWrite("project-1", stale)
    enqueueRecoveryWrite("project-1", newest)
    expect(first).toHaveBeenCalledOnce()
    expect(stale).not.toHaveBeenCalled()
    expect(newest).not.toHaveBeenCalled()

    releaseFirst?.()
    await flushRecoveryWrites("project-1")

    expect(stale).not.toHaveBeenCalled()
    expect(newest).toHaveBeenCalledOnce()
  })

  it("waits for every project and reports write failure", async () => {
    enqueueRecoveryWrite("good", async () => undefined)
    enqueueRecoveryWrite("bad", async () => {
      throw new Error("disk full")
    })

    await expect(flushRecoveryWrites()).rejects.toThrow("disk full")
  })
})
