// @vitest-environment jsdom

import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { MessageView } from "."
vi.mock("./UserMessage", () => ({ UserMessage: () => null }))
vi.mock("./AssistantMessage", () => ({ AssistantMessage: () => null }))
vi.mock("./CompactSummaryCard", () => ({ CompactSummaryCard: () => null }))

vi.mock("@zoeymind/i18n", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

vi.mock("../../../ai-chat/context/ai-chat-runtime", () => ({
  useAIChatRuntime: () => ({
    messages: [],
    status: "ready",
  }),
}))

vi.mock("../../compaction/useCompactionStore", () => ({
  useCompactionStore: (selector: (state: { compaction: undefined }) => unknown) =>
    selector({ compaction: undefined }),
}))

describe("MessageView", () => {
  it("renders an empty transcript without a runtime pagination error", () => {
    render(
      <MessageView models={[]} selectedModel="" setSelectedModel={vi.fn()} maxTokens={128_000} />
    )

    expect(screen.queryByText("mindmap.aiChat.message.viewHistory")).toBeNull()

    expect(screen.getByRole("region", { name: "mindmap.aiChat.core.conversation" })).toBeTruthy()
    expect(
      screen.getByRole("region", { name: "mindmap.aiChat.core.conversation" }).className
    ).toContain("no-scrollbar")
    expect(screen.getByRole("log").getAttribute("aria-busy")).toBe("false")
    expect(
      screen.getByRole("navigation", { name: "mindmap.aiChat.core.messageNavigation" })
    ).toBeTruthy()
  })
})
