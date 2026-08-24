// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { UIMessage } from "@ai-sdk/react"
import { setModuleAIChatRuntime } from "../context/ai-chat-runtime"
import { chatDB } from "../storage/chatDB"
import { useAIChatV2Store } from "./useAIChatV2Store"

const targetMessage: UIMessage = {
  id: "resume-target",
  role: "user",
  parts: [{ type: "text", text: "original" }],
}

describe("AI chat resume resend", () => {
  beforeEach(() => {
    useAIChatV2Store.setState({ currentConversationId: "conversation-1" })
  })

  afterEach(() => {
    setModuleAIChatRuntime(null)
    vi.restoreAllMocks()
  })

  it("loads the persisted transcript and sends one request when resume is triggered concurrently", async () => {
    let releaseLoad: (() => void) | undefined
    const loadGate = new Promise<void>(resolve => {
      releaseLoad = resolve
    })
    vi.spyOn(chatDB, "loadConversationState").mockImplementation(async () => {
      await loadGate
      return { transcript: [targetMessage], compaction: null }
    })
    vi.spyOn(chatDB, "truncateConversation").mockResolvedValue()

    const sendMessage = vi.fn()
    const setMessages = vi.fn()
    setModuleAIChatRuntime({
      sendMessage,
      regenerate: vi.fn(),
      stop: vi.fn(),
      setMessages,
      addToolOutput: vi.fn().mockResolvedValue(undefined),
      messages: [],
      status: "ready",
      error: undefined,
    })

    const resend = () =>
      useAIChatV2Store
        .getState()
        .resendMessageFrom(
          targetMessage.id,
          { text: "resumed", attachments: [] },
          "workspace-1",
          "model-1"
        )

    const first = resend()
    const duplicate = resend()
    expect(await duplicate).toBe(false)
    releaseLoad?.()

    expect(await first).toBe(true)
    expect(setMessages).toHaveBeenCalledWith([])
    expect(sendMessage).toHaveBeenCalledOnce()
    expect(sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        text: "resumed",
        metadata: expect.objectContaining({ model: "model-1" }),
      })
    )
  })
})
