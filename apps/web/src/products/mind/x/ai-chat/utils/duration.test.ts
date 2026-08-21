import { describe, expect, it } from "vitest"
import { formatElapsedMs } from "./duration"

describe("formatElapsedMs", () => {
  it("shows sub-second completed work instead of zero", () => {
    expect(formatElapsedMs(0)).toBe("< 1s")
    expect(formatElapsedMs(450)).toBe("< 1s")
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
