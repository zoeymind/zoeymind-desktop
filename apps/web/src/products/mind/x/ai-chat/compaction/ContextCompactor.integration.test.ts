import { describe, expect, it, vi } from "vitest"
import type { ToolSet, UIMessage } from "ai"
import {
  ContextCompactor,
  CompactionUnavailableError,
  type ContextCompactorDependencies,
} from "./ContextCompactor"
import type { CompactionState } from "../storage/chatDB"
import type { ModelsConfig } from "@/shared/native"

const config: ModelsConfig = {
  providers: [{ id: "provider", name: "Local", kind: "ollama" }],
  models: [
    {
      id: "model",
      providerId: "provider",
      name: "model-name",
      alias: "Model",
      maxContextTokens: 5_000,
      maxOutputTokens: 500,
    },
  ],
  defaults: { chat: "model" },
}

function transcript(): UIMessage[] {
  const long = "context ".repeat(4_000)
  return [
    { id: "u1", role: "user", parts: [{ type: "text", text: long }] },
    { id: "a1", role: "assistant", parts: [{ type: "text", text: "done" }] },
    { id: "u2", role: "user", parts: [{ type: "text", text: long }] },
    { id: "a2", role: "assistant", parts: [{ type: "text", text: "done" }] },
    { id: "u3", role: "user", parts: [{ type: "text", text: "latest" }] },
  ]
}

function dependencies(options?: { fail?: boolean }) {
  let state: CompactionState | null = null
  const commit = vi.fn(
    async (_conversationId: string, _transcript: UIMessage[], next: CompactionState) => {
      state = next
    }
  )
  const deps: ContextCompactorDependencies = {
    loadConfig: async () => config,
    loadState: async () => ({ transcript: transcript(), compaction: state }),
    commit,
    generateSummary: async () => {
      if (options?.fail) throw new Error("summary failed")
      return "<thinking>hidden</thinking>## 1. 用户的总意图\n继续"
    },
    now: () => 10,
    createId: () => "id",
  }
  return { deps, commit, getState: () => state }
}

describe("ContextCompactor", () => {
  it("commits originals then returns summary plus the whole recent tail", async () => {
    const fixture = dependencies()
    const result = await new ContextCompactor(fixture.deps).prepare({
      conversationId: "conversation",
      transcript: transcript(),
      requestedModelId: "model",
      system: "system",
      tools: {} as ToolSet,
      force: true,
    })
    expect(result.compacted).toBe(true)
    expect(result.messages[0].role).toBe("user")
    expect(result.state?.summary).not.toContain("thinking")
    expect(fixture.commit).toHaveBeenCalledWith(
      "conversation",
      expect.arrayContaining([
        expect.objectContaining({ id: "u1" }),
        expect.objectContaining({ id: "u3" }),
      ]),
      expect.objectContaining({ compactedThroughMessageId: "a2" })
    )
  })

  it("falls back atomically on ordinary summary failure", async () => {
    const fixture = dependencies({ fail: true })
    const original = transcript()
    const result = await new ContextCompactor(fixture.deps).prepare({
      conversationId: "conversation-fallback",
      transcript: original,
      requestedModelId: "model",
      system: "system",
      tools: {} as ToolSet,
      force: false,
    })
    expect(result.messages).toBe(original)
    expect(fixture.commit).not.toHaveBeenCalled()
  })

  it("propagates forced failures instead of replaying the oversized request", async () => {
    const fixture = dependencies({ fail: true })
    await expect(
      new ContextCompactor(fixture.deps).prepare({
        conversationId: "conversation-force",
        transcript: transcript(),
        requestedModelId: "model",
        system: "system",
        tools: {} as ToolSet,
        force: true,
      })
    ).rejects.toThrow("summary failed")
    expect(fixture.commit).not.toHaveBeenCalled()
  })

  it("returns COMPACTION_UNAVAILABLE when no whole prefix can be removed", async () => {
    const fixture = dependencies()
    await expect(
      new ContextCompactor(fixture.deps).prepare({
        conversationId: "conversation-short",
        transcript: [{ id: "u", role: "user", parts: [{ type: "text", text: "only" }] }],
        requestedModelId: "model",
        system: "system",
        tools: {} as ToolSet,
        force: true,
      })
    ).rejects.toBeInstanceOf(CompactionUnavailableError)
  })
})
