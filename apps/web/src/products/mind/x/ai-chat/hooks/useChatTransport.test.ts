import { describe, expect, it, vi } from "vitest"
import type { UIMessage } from "ai"
import { awaitWithAbort, readTurnStartedAt } from "./useChatTransport"

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

describe("awaitWithAbort", () => {
  it("rejects an uninterruptible preflight wait when the request is cancelled", async () => {
    const controller = new AbortController()
    const never = new Promise<string>(() => {})
    const pending = awaitWithAbort(never, controller.signal)
    controller.abort()
    await expect(pending).rejects.toMatchObject({ name: "AbortError" })
  })

  it("removes its abort listener when preflight settles", async () => {
    const controller = new AbortController()
    const remove = vi.spyOn(controller.signal, "removeEventListener")
    await expect(awaitWithAbort(Promise.resolve("ready"), controller.signal)).resolves.toBe("ready")
    expect(remove).toHaveBeenCalledWith("abort", expect.any(Function))
  })
})
