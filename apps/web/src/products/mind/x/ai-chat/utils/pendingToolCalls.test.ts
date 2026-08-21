import { describe, expect, it } from "vitest"
import type { UIMessage } from "@ai-sdk/react"
import { hasPendingToolCalls, isPendingToolPart } from "./pendingToolCalls"

describe("pending tool call state", () => {
  it("recognizes streaming and available tool inputs", () => {
    expect(isPendingToolPart({ type: "tool-edit", state: "input-streaming" })).toBe(true)
    expect(isPendingToolPart({ type: "tool-question", state: "input-available" })).toBe(true)
    expect(isPendingToolPart({ type: "tool-read", state: "output-available" })).toBe(false)
  })

  it("derives processing from the latest assistant message when SDK status is ready", () => {
    const messages = [
      { id: "user", role: "user", parts: [] },
      {
        id: "assistant",
        role: "assistant",
        parts: [{ type: "tool-edit", state: "input-available" }],
      },
    ] as UIMessage[]

    expect(hasPendingToolCalls(messages)).toBe(true)
  })
})
