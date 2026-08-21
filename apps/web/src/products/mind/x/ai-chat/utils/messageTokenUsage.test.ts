import { describe, expect, it } from "vitest"
import type { UIMessage } from "@ai-sdk/react"
import { mapUserMessageTokenUsage } from "./messageTokenUsage"

const models = [
  {
    id: "model-a",
    name: "Model A",
    provider: "openai",
    maxContextTokens: 32_000,
  },
]

describe("mapUserMessageTokenUsage", () => {
  it("associates each user message with its following assistant usage", () => {
    const messages = [
      { id: "user-1", role: "user", parts: [] },
      {
        id: "assistant-1",
        role: "assistant",
        parts: [],
        metadata: { modelId: "model-a", totalUsage: { totalTokens: 1_200 } },
      },
      { id: "user-2", role: "user", parts: [] },
      {
        id: "assistant-2",
        role: "assistant",
        parts: [],
        metadata: { totalUsage: { inputTokens: 2_000, outputTokens: 300 } },
      },
    ] as UIMessage[]

    expect([...mapUserMessageTokenUsage(messages, models, 128_000)]).toEqual([
      ["user-1", { usedTokens: 1_200, maxTokens: 32_000 }],
      ["user-2", { usedTokens: 2_300, maxTokens: 128_000 }],
    ])
  })

  it("does not invent usage for an unanswered or metadata-free turn", () => {
    const messages = [
      { id: "user-1", role: "user", parts: [] },
      { id: "assistant-1", role: "assistant", parts: [] },
      { id: "user-2", role: "user", parts: [] },
    ] as UIMessage[]

    expect(mapUserMessageTokenUsage(messages, models, 128_000).size).toBe(0)
  })
})
