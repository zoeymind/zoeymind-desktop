import { describe, expect, it } from "vitest"
import { countTokens } from "./tokenCounter"

describe("countTokens", () => {
  it("uses characters-per-token as a divisor for ASCII text", () => {
    expect(countTokens("a".repeat(7_800))).toBe(2_028)
  })

  it("combines CJK and other-character weights", () => {
    expect(countTokens(`${"中".repeat(100)}${"a".repeat(100)}`)).toBe(101)
  })
})
