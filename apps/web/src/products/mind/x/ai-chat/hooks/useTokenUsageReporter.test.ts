import { describe, expect, it } from "vitest"
import type { UIMessage } from "ai"
import type { CompactionState } from "../storage/sqliteChatStore"
import { readContextOccupancy } from "./useTokenUsageReporter"

const assistant = (metadata: Record<string, unknown>): UIMessage => ({
  id: "assistant",
  role: "assistant",
  parts: [{ type: "text", text: "done" }],
  metadata,
})

describe("readContextOccupancy", () => {
  it("ignores cumulative billing usage", () => {
    const messages = [assistant({ totalUsage: { totalTokens: 120_000 } })]
    expect(readContextOccupancy(messages)).toBeLessThan(100)
  })

  it("uses final-step occupancy and locally accounts for later messages", () => {
    const messages = [
      assistant({ contextUsage: { totalTokens: 4_000 } }),
      { id: "user", role: "user", parts: [{ type: "text", text: "a".repeat(400) }] },
    ] as UIMessage[]
    expect(readContextOccupancy(messages)).toBeGreaterThan(4_000)
    expect(readContextOccupancy(messages)).toBeLessThan(4_200)
  })

  it("drops compacted history and its stale context usage from occupancy", () => {
    const messages = [
      { id: "old-user", role: "user", parts: [{ type: "text", text: "x".repeat(20_000) }] },
      assistant({ modelId: "model", contextUsage: { totalTokens: 90_000 } }),
      { id: "new-user", role: "user", parts: [{ type: "text", text: "continue" }] },
    ] as UIMessage[]
    const compaction: CompactionState = {
      conversationId: "conversation",
      summary: "short handoff",
      summaryMessageId: "summary",
      compactedThroughMessageId: "assistant",
      compactedAt: 1,
      modelId: "model",
      compactedCount: 2,
      tokensBefore: 90_000,
    }

    expect(readContextOccupancy(messages, compaction)).toBeLessThan(100)
  })
})
