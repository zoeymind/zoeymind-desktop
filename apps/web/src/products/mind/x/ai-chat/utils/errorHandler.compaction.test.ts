import { describe, expect, it } from "vitest"
import { classifyChatError, normalizeChatError } from "./errorHandler"

describe("context overflow errors", () => {
  it("prefers structured provider codes", () => {
    expect(normalizeChatError({ statusCode: 400, code: "context_length_exceeded" })).toBe(
      "CONTEXT_OVERFLOW"
    )
  })

  it("recognizes provider phrase fallbacks", () => {
    expect(normalizeChatError(new Error("maximum context length exceeded"))).toBe(
      "CONTEXT_OVERFLOW"
    )
  })

  it("round-trips only the normalized UI code", () => {
    expect(classifyChatError("CONTEXT_OVERFLOW")).toBe("CONTEXT_OVERFLOW")
    expect(normalizeChatError(new Error("connection reset"))).toBe("REQUEST_FAILED")
  })
})
