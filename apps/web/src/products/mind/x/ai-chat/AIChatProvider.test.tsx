// @vitest-environment jsdom
import { act, render, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { AIChatProvider } from "./AIChatProvider"
import { useAIChatRuntime, type AIChatRuntime } from "./context/ai-chat-runtime"
import { ProjectSessionContext } from "@/products/mind/editor-session/project-session-context"
import { createProjectSessionStore } from "@/products/mind/editor-session/project-session-store"
import { useAIChatV2Store } from "./stores/useAIChatV2Store"

const transport = vi.hoisted(() => ({ nextError: null as Error | null }))
const requests = vi.hoisted(() => vi.fn())
vi.mock("./hooks/useChatTransport", () => ({
  clearPreparedTurn: vi.fn(),
  useChatTransport: () => async (_url: unknown, init: RequestInit) => {
    requests(JSON.parse(String(init.body)))
    if (transport.nextError) {
      const error = transport.nextError
      transport.nextError = null
      throw error
    }
    return new Response(
      'data: {"type":"start","messageId":"reply"}\n\ndata: {"type":"finish"}\n\ndata: [DONE]\n\n',
      {
        headers: { "Content-Type": "text/event-stream", "x-vercel-ai-ui-message-stream": "v1" },
      }
    )
  },
}))
vi.mock("./hooks/useConversationLifecycle", () => ({
  useConversationLifecycle: () => ({ isInitialized: true }),
}))
vi.mock("./hooks/useTokenUsageReporter", () => ({ useTokenUsageReporter: vi.fn() }))
vi.mock("./hooks/useToolDispatcher", () => ({ useToolDispatcher: () => ({ onToolCall: vi.fn() }) }))
beforeEach(() => {
  requests.mockClear()
  transport.nextError = null
  useAIChatV2Store.setState({
    currentConversationId: "conversation",
    conversationIdsByWorkspace: {
      ...useAIChatV2Store.getState().conversationIdsByWorkspace,
      "error-recovery": "conversation",
    },
    inputMessage: "",
  })
})

afterEach(() => {
  vi.useRealTimers()
})

it("routes the first real SDK request with session identity before the canvas exists", async () => {
  const session = createProjectSessionStore("unsaved-cold-start")
  let runtime: AIChatRuntime | undefined
  function Consumer() {
    runtime = useAIChatRuntime()
    return null
  }
  const { unmount } = render(
    <ProjectSessionContext.Provider value={session}>
      <AIChatProvider>
        <Consumer />
      </AIChatProvider>
    </ProjectSessionContext.Provider>
  )
  expect(session.getState().mindMap).toBeNull()
  await act(async () => {
    await runtime!.sendMessage({
      text: "hello",
      metadata: { model: "model", conversationId: "conversation" },
    })
  })
  await waitFor(() => expect(requests).toHaveBeenCalledOnce())
  expect(requests).toHaveBeenCalledWith(
    expect.objectContaining({
      workspaceId: "unsaved-cold-start",
      conversationId: "conversation",
      model: "model",
    })
  )
  unmount()
})

it("does not replay an SDK error after replacing the transcript and handles the next error", async () => {
  const session = createProjectSessionStore("error-recovery")
  let runtime: AIChatRuntime | undefined
  function Consumer() {
    runtime = useAIChatRuntime()
    return null
  }
  const { unmount } = render(
    <ProjectSessionContext.Provider value={session}>
      <AIChatProvider>
        <Consumer />
      </AIChatProvider>
    </ProjectSessionContext.Provider>
  )

  transport.nextError = new Error("first failure")
  await act(async () => {
    await runtime!.sendMessage({
      text: "first attempt",
      metadata: { model: "model", conversationId: "conversation" },
    })
  })
  await waitFor(() => expect(runtime!.error).toBeInstanceOf(Error))

  const healthyTranscript = [
    {
      id: "healthy-user",
      role: "user" as const,
      parts: [{ type: "text" as const, text: "loaded" }],
    },
    {
      id: "healthy-assistant",
      role: "assistant" as const,
      parts: [{ type: "text" as const, text: "healthy" }],
    },
  ]
  act(() => runtime!.setMessages(healthyTranscript))
  const delay = Promise.withResolvers<void>()
  setTimeout(delay.resolve, 250)
  await delay.promise
  expect(runtime!.messages).toEqual(healthyTranscript)
  expect(runtime!.error).toBeUndefined()

  transport.nextError = new Error("second failure")
  await act(async () => {
    await runtime!.sendMessage({
      text: "second attempt",
      metadata: { model: "model", conversationId: "conversation" },
    })
  })
  await waitFor(() =>
    expect(
      runtime!.messages.some(message =>
        message.parts.some(part =>
          "errorText" in part ? part.errorText === "second failure" : false
        )
      )
    ).toBe(true)
  )
  unmount()
})
