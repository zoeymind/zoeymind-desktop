import { beforeEach, describe, expect, it, vi } from "vitest"
import type { ToolSet, UIMessage } from "ai"
import {
  ContextCompactor,
  CompactionUnavailableError,
  type ContextCompactorDependencies,
} from "./ContextCompactor"
import type { CompactionState } from "../storage/sqliteChatStore"
import type { ModelsConfig } from "@/shared/native"
import { resetCompaction, useCompactionStore } from "./useCompactionStore"

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
    now: vi.fn().mockReturnValueOnce(10).mockReturnValue(1_510),
    createId: () => "id",
  }
  return { deps, commit, getState: () => state }
}

beforeEach(() => resetCompaction(undefined))

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
    expect(result.state).toMatchObject({ durationMs: 1_500 })
    expect(result.state?.tokensAfter).toBeGreaterThan(0)
    expect(result.state?.tokensAfter).toBeLessThan(result.state?.tokensBefore ?? 0)
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

describe("occupancy and cancellation regressions", () => {
  const modestTranscript = (metadata?: Record<string, unknown>): UIMessage[] => [
    { id: "u1", role: "user", parts: [{ type: "text", text: "context ".repeat(700) }] },
    { id: "a1", role: "assistant", parts: [{ type: "text", text: "done" }] },
    { id: "u2", role: "user", parts: [{ type: "text", text: "context ".repeat(700) }] },
    {
      id: "a2",
      role: "assistant",
      parts: [{ type: "text", text: "done" }],
      metadata: { modelId: "model", ...metadata },
    },
    { id: "u3", role: "user", parts: [{ type: "text", text: "continue" }] },
  ]

  function fixture(messages: UIMessage[]) {
    const commit = vi.fn(async () => {})
    const generateSummary = vi.fn(async () => "summary")
    const deps: ContextCompactorDependencies = {
      loadConfig: async () => config,
      loadState: async () => ({ transcript: messages, compaction: null }),
      commit,
      generateSummary,
      now: () => 0,
      createId: () => "regression",
    }
    return { deps, commit, generateSummary }
  }

  it("does not treat cumulative multi-step billing usage as context occupancy", async () => {
    const messages = modestTranscript({ totalUsage: { totalTokens: 120_000 } })
    const test = fixture(messages)
    const result = await new ContextCompactor(test.deps).prepare({
      conversationId: "billing",
      transcript: messages,
      requestedModelId: "model",
      system: "system",
      tools: {} as ToolSet,
      force: false,
    })
    expect(result.compacted).toBe(false)
    expect(test.generateSummary).not.toHaveBeenCalled()
  })

  it("uses final-step context usage as occupancy", async () => {
    const messages = modestTranscript({ contextUsage: { totalTokens: 4_900 } }).map(message =>
      message.id === "u1" || message.id === "u2"
        ? { ...message, parts: [{ type: "text" as const, text: "context ".repeat(1_100) }] }
        : message
    )
    const test = fixture(messages)
    const result = await new ContextCompactor(test.deps).prepare({
      conversationId: "occupancy",
      transcript: messages,
      requestedModelId: "model",
      system: "system",
      tools: {} as ToolSet,
      force: false,
    })
    expect(result.compacted).toBe(true)
    expect(result.state?.tokensBefore).toBeGreaterThanOrEqual(4_900)
  })

  it("rejects cancellation before summary work begins", async () => {
    const messages = transcript()
    const test = fixture(messages)
    const controller = new AbortController()
    controller.abort()
    await expect(
      new ContextCompactor(test.deps).prepare({
        conversationId: "cancelled-before",
        transcript: messages,
        requestedModelId: "model",
        system: "system",
        tools: {} as ToolSet,
        force: true,
        signal: controller.signal,
      })
    ).rejects.toMatchObject({ name: "AbortError" })
    expect(test.generateSummary).not.toHaveBeenCalled()
    expect(test.commit).not.toHaveBeenCalled()
  })

  it("aborts a late summary without committing", async () => {
    const messages = transcript()
    const test = fixture(messages)
    let resolveSummary!: (summary: string) => void
    test.deps.generateSummary = vi.fn(
      () => new Promise<string>(resolve => void (resolveSummary = resolve))
    )
    const controller = new AbortController()
    const pending = new ContextCompactor(test.deps).prepare({
      conversationId: "cancelled",
      transcript: messages,
      requestedModelId: "model",
      system: "system",
      tools: {} as ToolSet,
      force: true,
      signal: controller.signal,
    })
    await vi.waitFor(() => expect(test.deps.generateSummary).toHaveBeenCalledOnce())
    controller.abort()
    resolveSummary("late")
    await expect(pending).rejects.toMatchObject({ name: "AbortError" })
    expect(test.commit).not.toHaveBeenCalled()
    expect(useCompactionStore.getState().phase).toBe("idle")
  })

  it("cancels while waiting behind another compaction attempt", async () => {
    const messages = transcript()
    const test = fixture(messages)
    let resolveFirst!: (summary: string) => void
    test.deps.generateSummary = vi
      .fn()
      .mockImplementationOnce(() => new Promise<string>(resolve => void (resolveFirst = resolve)))
      .mockResolvedValue("third summary")
    const compactor = new ContextCompactor(test.deps)
    const first = compactor.prepare({
      conversationId: "queued",
      transcript: messages,
      requestedModelId: "model",
      system: "system",
      tools: {} as ToolSet,
      force: true,
    })
    await vi.waitFor(() => expect(test.deps.generateSummary).toHaveBeenCalledOnce())
    const controller = new AbortController()
    const second = compactor.prepare({
      conversationId: "queued",
      transcript: messages,
      requestedModelId: "model",
      system: "system",
      tools: {} as ToolSet,
      force: true,
      signal: controller.signal,
    })
    controller.abort()
    await expect(second).rejects.toMatchObject({ name: "AbortError" })
    const third = compactor.prepare({
      conversationId: "queued",
      transcript: messages,
      requestedModelId: "model",
      system: "system",
      tools: {} as ToolSet,
      force: true,
    })
    await Promise.resolve()
    expect(test.deps.generateSummary).toHaveBeenCalledOnce()
    resolveFirst("summary")
    await first
    await third
    expect(test.deps.generateSummary).toHaveBeenCalledTimes(2)
  })

  it("does not publish into a newly selected conversation", async () => {
    const messages = transcript()
    const test = fixture(messages)
    let resolveSummary!: (summary: string) => void
    test.deps.generateSummary = vi.fn(
      () => new Promise<string>(resolve => void (resolveSummary = resolve))
    )
    const pending = new ContextCompactor(test.deps).prepare({
      conversationId: "old",
      transcript: messages,
      requestedModelId: "model",
      system: "system",
      tools: {} as ToolSet,
      force: true,
    })
    await vi.waitFor(() => expect(test.deps.generateSummary).toHaveBeenCalledOnce())
    resetCompaction("new")
    resolveSummary("late")
    await expect(pending).rejects.toMatchObject({ name: "AbortError" })
    expect(test.commit).not.toHaveBeenCalled()
    expect(useCompactionStore.getState()).toMatchObject({ conversationId: "new", phase: "idle" })
  })
})
