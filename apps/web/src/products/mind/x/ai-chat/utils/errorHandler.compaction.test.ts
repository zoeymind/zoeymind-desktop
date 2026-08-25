import { describe, expect, it } from "vitest"
import {
  classifyChatError,
  hasErrorPart,
  isClientRuntimeError,
  normalizeChatError,
  parseChatError,
  serializeChatError,
} from "./errorHandler"

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

  it("does not classify a dynamic MCP tool error as a whole-chat error", () => {
    expect(
      hasErrorPart({
        id: "assistant-mcp-error",
        role: "assistant",
        parts: [
          {
            type: "dynamic-tool",
            toolName: "mcp_context7_query_docs",
            toolCallId: "call-mcp-error",
            state: "output-error",
            input: { query: "React" },
            errorText: "MCP server returned 500",
          },
        ],
      })
    ).toBe(false)
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

describe("provider error summaries", () => {
  it("preserves a redacted provider message", () => {
    const serialized = serializeChatError({
      message:
        "Provider request failed; Authorization: Bearer bearer-secret; https://generativelanguage.googleapis.com/v1beta/models?key=gemini-secret",
    })

    expect(parseChatError(serialized)).toEqual({
      code: "REQUEST_FAILED",
      message:
        "Provider request failed; Authorization: [REDACTED]; https://generativelanguage.googleapis.com/v1beta/models?key=[REDACTED]",
    })
    expect(serialized).not.toContain("bearer-secret")
    expect(serialized).not.toContain("gemini-secret")
  })
})
