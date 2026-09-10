// @vitest-environment jsdom
import { StrictMode } from "react"
import type { UIMessage } from "ai"
import { act, renderHook, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { useConversationLifecycle } from "./useConversationLifecycle"
import { sqliteChatStore } from "../storage/sqliteChatStore"
import { useAIChatV2Store } from "../stores/useAIChatV2Store"
import { useTabs } from "@/shared/tabs/store"

vi.mock("../memory/indexer", () => ({ indexer: { enqueue: vi.fn() } }))
afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

function resetConversationState(): void {
  useTabs.setState({ activeId: "workspace" })
  useAIChatV2Store.setState({
    currentConversationId: undefined,
    conversationIdsByWorkspace: {},
    knowledgeBaseIdsByWorkspace: {},
    compactionsByWorkspace: {},
  })
}

beforeEach(() => {
  resetConversationState()
})

it("initializes once through StrictMode replay without repeating on message updates", async () => {
  vi.spyOn(sqliteChatStore, "getConversations").mockResolvedValue([])
  const create = vi.fn().mockResolvedValue(undefined)
  const original = useAIChatV2Store.getState().createNewConversation
  useAIChatV2Store.setState({ createNewConversation: create })
  try {
    const { result, rerender, unmount } = renderHook(
      ({ messages }) =>
        useConversationLifecycle({ workspaceId: "workspace", status: "ready", messages }),
      { initialProps: { messages: [] as UIMessage[] }, wrapper: StrictMode }
    )
    await waitFor(() => expect(result.current.isInitialized).toBe(true))
    rerender({ messages: [{ id: "u", role: "user", parts: [{ type: "text", text: "new" }] }] })
    expect(create).toHaveBeenCalledOnce()
    unmount()
  } finally {
    useAIChatV2Store.setState({ createNewConversation: original })
  }
})

it("persists legacy messages without metadata to the workspace conversation", async () => {
  vi.spyOn(sqliteChatStore, "getConversations").mockResolvedValue([])
  const save = vi.spyOn(sqliteChatStore, "saveMessages").mockResolvedValue(undefined)
  const original = useAIChatV2Store.getState().createNewConversation
  useTabs.setState({ activeId: "workspace-B" })
  useAIChatV2Store.setState({
    currentConversationId: "B",
    conversationIdsByWorkspace: { "workspace-A": "A", "workspace-B": "B" },
    createNewConversation: vi.fn().mockResolvedValue(undefined),
  })
  const messages: UIMessage[] = [
    {
      id: "u",
      role: "user",
      parts: [{ type: "text", text: "from legacy A" }],
    },
  ]
  try {
    const { result, unmount } = renderHook(() =>
      useConversationLifecycle({ workspaceId: "workspace-A", status: "ready", messages })
    )
    await waitFor(() => expect(result.current.isInitialized).toBe(true))
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 1100))
    })
    expect(save).toHaveBeenCalledWith("A", messages)
    expect(save).not.toHaveBeenCalledWith("B", expect.anything())
    expect(useAIChatV2Store.getState().currentConversationId).toBe("B")
    unmount()
  } finally {
    useAIChatV2Store.setState({ createNewConversation: original })
  }
})
