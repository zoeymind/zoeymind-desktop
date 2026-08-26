// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { ChatHistoryPanel } from "./ChatHistoryPanel"

const store = vi.hoisted(() => ({
  getConversations: vi.fn(),
  getAllConversations: vi.fn(),
  loadMessages: vi.fn(),
  deleteConversation: vi.fn(),
}))

vi.mock("@zoeymind/i18n", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))
vi.mock("../../storage/sqliteChatStore", () => ({ sqliteChatStore: store }))
vi.mock("../../../ai-chat/utils/timeFormat", () => ({ formatRelativeTime: () => "Today" }))
vi.mock("motion/react", () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
      <div {...props}>{children}</div>
    ),
  },
}))

const currentConversation = {
  id: "current",
  workspaceId: "workspace-a",
  title: "Current conversation",
  createdAt: 1,
  updatedAt: 2,
}
const otherConversation = {
  id: "other",
  workspaceId: "workspace-b",
  title: "Other conversation",
  createdAt: 1,
  updatedAt: 3,
}

describe("ChatHistoryPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    store.getConversations.mockResolvedValue([currentConversation])
    store.getAllConversations.mockResolvedValue([otherConversation, currentConversation])
    store.loadMessages.mockResolvedValue([])
  })

  it("defaults to the current project and loads all conversations after switching tabs", async () => {
    render(
      <ChatHistoryPanel
        isOpen
        onClose={vi.fn()}
        workspaceId="workspace-a"
        onSelectConversation={vi.fn()}
      />
    )

    await waitFor(() => expect(store.getConversations).toHaveBeenCalledWith("workspace-a"))
    expect(screen.getByText("Current conversation")).toBeTruthy()
    expect(store.getAllConversations).not.toHaveBeenCalled()

    fireEvent.click(
      screen.getByRole("tab", { name: "mindmap.aiChat.history.tabs.allConversations" })
    )

    await waitFor(() => expect(store.getAllConversations).toHaveBeenCalledOnce())
    expect(screen.getByText("Other conversation")).toBeTruthy()
    expect(screen.getByText("Current conversation")).toBeTruthy()
  })
})
