import { afterEach, describe, expect, it, vi } from "vitest"
import {
  clearOverflowRecovery,
  markOverflowError,
  resetOverflowRecovery,
  scheduleOverflowRecovery,
  shouldSuppressOverflowError,
} from "./overflowRecovery"

describe("overflow recovery scheduling", () => {
  afterEach(() => {
    vi.useRealTimers()
    resetOverflowRecovery()
  })

  it("does not start regeneration inside the failed request callback", () => {
    vi.useFakeTimers()
    const regenerate = vi.fn()
    const scheduled = scheduleOverflowRecovery({
      code: "CONTEXT_OVERFLOW",
      attemptKey: "conversation:user",
      isError: true,
      hasToolPart: false,
      regenerate,
    })
    expect(scheduled).toBe(true)
    expect(regenerate).not.toHaveBeenCalled()
    expect(shouldSuppressOverflowError("CONTEXT_OVERFLOW", "conversation:user")).toBe(true)
    vi.runOnlyPendingTimers()
    expect(regenerate).toHaveBeenCalledWith("conversation:user")
  })

  it("allows only one automatic recovery and surfaces its overflow", () => {
    vi.useFakeTimers()
    const regenerate = vi.fn()
    scheduleOverflowRecovery({
      code: "CONTEXT_OVERFLOW",
      attemptKey: "conversation:user",
      isError: true,
      hasToolPart: false,
      regenerate,
    })
    markOverflowError("CONTEXT_OVERFLOW", "conversation:user")
    expect(shouldSuppressOverflowError("CONTEXT_OVERFLOW", "conversation:user")).toBe(false)
    expect(
      scheduleOverflowRecovery({
        code: "CONTEXT_OVERFLOW",
        attemptKey: "conversation:user",
        isError: true,
        hasToolPart: false,
        regenerate,
      })
    ).toBe(false)
    clearOverflowRecovery("conversation:user")
  })

  it("never replays a tool-bearing partial response", () => {
    expect(
      scheduleOverflowRecovery({
        code: "CONTEXT_OVERFLOW",
        attemptKey: "conversation:user",
        isError: true,
        hasToolPart: true,
        regenerate: vi.fn(),
      })
    ).toBe(false)
  })
})
