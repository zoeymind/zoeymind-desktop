import { describe, expect, it } from "vitest"
import { classifyChatError, isClientRuntimeError, normalizeChatError } from "./errorHandler"

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

  it("does not classify React runtime invariants as provider failures", () => {
    const error = new Error(
      "Maximum update depth exceeded. This can happen when a component repeatedly calls setState"
    )
    expect(normalizeChatError(error)).toBe("CLIENT_RUNTIME_ERROR")
    expect(classifyChatError("CLIENT_RUNTIME_ERROR")).toBe("CLIENT_RUNTIME_ERROR")
    expect(isClientRuntimeError(error)).toBe(true)
    expect(isClientRuntimeError("CLIENT_RUNTIME_ERROR")).toBe(true)
    expect(isClientRuntimeError(new Error("connection reset"))).toBe(false)
  })
})
