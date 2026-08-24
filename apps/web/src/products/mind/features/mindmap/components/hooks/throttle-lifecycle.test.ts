// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest"
import { throttle } from "simple-mind-map/src/utils/index"

afterEach(() => {
  vi.useRealTimers()
})

describe("simple-mind-map throttled lifecycle work", () => {
  it("does not run queued work after its owner cancels during teardown", () => {
    vi.useFakeTimers()
    const callback = vi.fn()
    const throttled = throttle(callback, 16)

    throttled()
    throttled.cancel()
    vi.advanceTimersByTime(16)

    expect(callback).not.toHaveBeenCalled()
  })
})
