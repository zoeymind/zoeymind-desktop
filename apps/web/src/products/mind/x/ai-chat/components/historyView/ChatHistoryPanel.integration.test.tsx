// @vitest-environment jsdom
import { useEffect, useState } from "react"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import type { UIMessage } from "ai"
import { ChatHistoryPanel } from "./ChatHistoryPanel"
import { useAIChatV2Store } from "../../stores/useAIChatV2Store"
import {
  registerModuleAIChatRuntime,
  unregisterModuleAIChatRuntime,
} from "../../context/ai-chat-runtime"
import { useTabs } from "@/shared/tabs/store"
const history = vi.hoisted(() => ({
  conversation: {
    id: "history-B",
    workspaceId: "closed-project-B",
    title: "Other project history",
    createdAt: 1,
    updatedAt: 2,
  },
  transcript: [
    {
      id: "old-user",
      role: "user",
      parts: [{ type: "text", text: "Saved conversation from project B" }],
    },
  ],
}))
vi.mock("../../storage/sqliteChatStore", () => ({
  sqliteChatStore: {
    getConversations: async () => [],
    getAllConversations: async () => [history.conversation],
    getConversation: async () => history.conversation,
    loadMessages: async () => history.transcript,
    loadConversationState: async () => ({ transcript: history.transcript, compaction: null }),
  },
}))
vi.mock("@zoeymind/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
vi.mock("../../../ai-chat/utils/timeFormat", () => ({ formatRelativeTime: () => "Today" }))
const owner = Symbol("current-panel")
afterEach(() => unregisterModuleAIChatRuntime("workspace-A", owner))

it("opens another project's history in the visible panel without its project runtime", async () => {
  useTabs.setState({
    activeId: "workspace-A",
    tabs: [{ id: "workspace-A", kind: "draft", title: "A" }],
  })
  useAIChatV2Store.setState({
    currentConversationId: "history-A",
    conversationIdsByWorkspace: { "workspace-A": "history-A" },
    knowledgeBaseIdsByWorkspace: {},
    compactionsByWorkspace: {},
  })
  const sent = vi.fn().mockResolvedValue(undefined)
  function Panel() {
    const [messages, setMessages] = useState<UIMessage[]>([])
    useEffect(() => {
      registerModuleAIChatRuntime("workspace-A", owner, {
        workspaceId: "workspace-A",
        instanceId: owner,
        messages,
        setMessages,
        sendMessage: sent,
        regenerate: async () => {},
        stop: async () => {},
        addToolOutput: async () => {},
        status: "ready",
        error: undefined,
      })
      return () => unregisterModuleAIChatRuntime("workspace-A", owner)
    }, [messages])
    return (
      <>
        <ChatHistoryPanel
          isOpen
          workspaceId="workspace-A"
          onClose={() => {}}
          onSelectConversation={id => {
            void useAIChatV2Store.getState().loadConversation(id, "workspace-A")
          }}
        />
        <div data-testid="visible-transcript">
          {messages
            .flatMap(message => message.parts)
            .map(part => (part.type === "text" ? part.text : ""))
            .join(" ")}
        </div>
      </>
    )
  }
  const { unmount } = render(<Panel />)
  fireEvent.click(screen.getByRole("tab", { name: "mindmap.aiChat.history.tabs.allConversations" }))
  fireEvent.click(await screen.findByText("Other project history"))
  await waitFor(() =>
    expect(screen.getByTestId("visible-transcript").textContent).toBe(
      "Saved conversation from project B"
    )
  )
  expect(useTabs.getState().activeId).toBe("workspace-A")
  expect(useAIChatV2Store.getState().currentConversationId).toBe("history-B")
  useAIChatV2Store.getState().setInputMessage("Continue in current document")
  await useAIChatV2Store.getState().sendMessage("workspace-A", "model")
  expect(sent).toHaveBeenCalledWith(
    expect.objectContaining({
      text: "Continue in current document",
      metadata: expect.objectContaining({ conversationId: "history-B" }),
    })
  )
  unmount()
})
