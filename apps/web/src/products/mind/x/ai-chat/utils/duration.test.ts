import { describe, expect, it } from "vitest"
import { formatElapsedMs } from "./duration"

describe("formatElapsedMs", () => {
  it("preserves sub-second precision", () => {
    expect(formatElapsedMs(0)).toBe("0ms")
    expect(formatElapsedMs(51.6)).toBe("52ms")
    expect(formatElapsedMs(450)).toBe("450ms")
  })

  it("formats seconds and minutes", () => {
    expect(formatElapsedMs(1_250)).toBe("1.3s")
    expect(formatElapsedMs(65_000)).toBe("1m5s")
  })

  it("rejects invalid values", () => {
    expect(formatElapsedMs(undefined)).toBeNull()
    expect(formatElapsedMs(Number.NaN)).toBeNull()
  })
})
