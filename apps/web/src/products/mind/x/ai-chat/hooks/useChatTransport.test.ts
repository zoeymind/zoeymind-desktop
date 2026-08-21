import { describe, expect, it } from "vitest"
import type { UIMessage } from "ai"
import { readTurnStartedAt } from "./useChatTransport"

describe("readTurnStartedAt", () => {
  it("keeps the original user send time across tool-result round trips", () => {
    const messages = [
      {
        id: "user-1",
        role: "user",
        metadata: { turnStartedAt: 1_000 },
        parts: [{ type: "text", text: "build this" }],
      },
      {
        id: "assistant-1",
        role: "assistant",
        parts: [
          {
            type: "tool-edit",
            toolCallId: "call-1",
            state: "output-available",
            input: {},
            output: { success: true },
          },
        ],
      },
    ] as UIMessage[]

    expect(readTurnStartedAt(messages)).toBe(1_000)
  })

  it("rejects missing and invalid timestamps", () => {
    expect(readTurnStartedAt([])).toBeUndefined()
    expect(
      readTurnStartedAt([
        { id: "user-1", role: "user", metadata: { turnStartedAt: "now" }, parts: [] },
      ] as UIMessage[])
    ).toBeUndefined()
  })
})
