// @vitest-environment jsdom
import { act, cleanup, fireEvent, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { ToolCallCard } from "./ToolCallCard"
import { TOOL_EXECUTION_INTERRUPTED } from "../../../ai-chat/utils/pendingToolCalls"

vi.mock("@zoeymind/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) =>
      ({
        "mindmap.aiChat.message.applyingEdit": "正在应用编辑",
        "mindmap.aiChat.message.executingTool": "正在执行工具",
        "mindmap.aiChat.message.toolStreamGenerating": "正在生成编辑内容",
        "mindmap.aiChat.message.toolStreamStalled": "等待模型继续输出",
        "mindmap.aiChat.message.mcpServer": "MCP server",
        "mindmap.aiChat.message.mcpTool": "Tool",
        "mindmap.aiChat.message.mcpRunning": "Running",
        "mindmap.aiChat.message.mcpCompleted": "Completed",
        "mindmap.aiChat.message.mcpFailed": "Failed",
        "mindmap.aiChat.message.questionAnsweredCount": "Answered 2 questions",
        "mindmap.aiChat.message.questionSkipped": "Skipped",
        "mindmap.aiChat.message.questionNoAnswer": "No answer",
      })[key] ?? key,
  }),
}))

vi.mock("../../../ai-chat/tools/registry", () => ({
  getToolLabel: (name: string) => name,
}))
afterEach(cleanup)

describe("ToolCallCard active disclosure", () => {
  it("keeps an available input expandable while the edit is applying", () => {
    const view = render(
      <ToolCallCard
        part={{
          type: "tool-edit_current_mindmap",
          toolCallId: "call-1",
          state: "input-available",
          input: { anchorTag: "a", patch: "update" },
        }}
      />
    )

    const trigger = view.getByRole("button", { expanded: false })
    expect(trigger.hasAttribute("disabled")).toBe(false)
    expect(view.container.textContent).toContain("正在应用编辑")
    fireEvent.click(trigger)
    expect(view.container.textContent).toContain("anchorTag")
  })

  it("keeps a large streaming edit input expandable with a bounded preview", () => {
    const patch = `PUT 1.=1:\n+${"large-patch-row\n".repeat(2_000)}`
    const view = render(
      <ToolCallCard
        part={{
          type: "tool-edit_current_mindmap",
          toolCallId: "call-large-stream",
          state: "input-streaming",
          input: { anchorTag: "a", patch },
        }}
      />
    )

    const trigger = view.getByRole("button", { expanded: false })
    expect(trigger.hasAttribute("disabled")).toBe(false)
    expect(view.container.textContent).toContain("正在生成编辑内容")
    fireEvent.click(trigger)
    expect(trigger.getAttribute("aria-expanded")).toBe("true")
    expect(view.container.textContent).toContain("large-patch-row")
    expect(view.container.textContent).toContain("内容过长，仅显示前")
    expect(view.container.textContent?.length).toBeLessThan(5_000)
  })

  it("shows estimated token progress without speed and marks a stalled stream", () => {
    vi.useFakeTimers()
    const view = render(
      <ToolCallCard
        part={{
          type: "tool-edit_current_mindmap",
          state: "input-streaming",
          input: { patch: "a".repeat(2_000) },
        }}
      />
    )

    expect(view.container.textContent).toContain("~1,000 tokens")
    expect(view.container.textContent).not.toContain("tok/s")
    expect(view.container.textContent).toContain("正在生成编辑内容")
    act(() => vi.advanceTimersByTime(3_000))
    expect(view.container.textContent).toContain("等待模型继续输出")
    vi.useRealTimers()
  })

  it("keeps repeated large streaming updates bounded", () => {
    const view = render(
      <ToolCallCard
        part={{
          type: "tool-edit_current_mindmap",
          state: "input-streaming",
          input: { patch: "" },
        }}
      />
    )

    for (let chunk = 1; chunk <= 100; chunk += 1) {
      view.rerender(
        <ToolCallCard
          part={{
            type: "tool-edit_current_mindmap",
            state: "input-streaming",
            input: { patch: "streamed-patch-row\n".repeat(chunk * 20) },
          }}
        />
      )
      expect(view.container.textContent?.length).toBeLessThan(5_000)
    }

    expect(view.container.textContent).not.toContain("streamed-patch-row")
  })

  it("bounds the expanded preview after a large edit input is complete", () => {
    const patch = `PUT 1.=1:\n+${"large-patch-row\n".repeat(2_000)}`
    const view = render(
      <ToolCallCard
        part={{
          type: "tool-edit_current_mindmap",
          state: "output-available",
          output: { success: true },
          input: { anchorTag: "a", patch },
        }}
      />
    )

    fireEvent.click(view.getByRole("button", { expanded: false }))
    expect(view.container.textContent).toContain("内容过长，仅显示前")
    expect(view.container.textContent?.length).toBeLessThan(6_000)
  })

  it("renders an interrupted tool as terminal instead of executing", () => {
    const view = render(
      <ToolCallCard
        part={{
          type: "tool-edit",
          toolCallId: "call-2",
          state: "output-error",
          errorText: TOOL_EXECUTION_INTERRUPTED,
        }}
      />
    )

    expect(view.container.textContent).toContain("mindmap.aiChat.message.aborted")
    expect(view.container.textContent).not.toContain("mindmap.aiChat.message.executing")
  })
})

describe("answered question card", () => {
  it("shows submitted answers in a collapsed disclosure card", () => {
    const view = render(
      <ToolCallCard
        part={{
          type: "tool-question",
          toolCallId: "question-answered",
          state: "output-available",
          input: {
            questions: [
              { question: "Which environment?" },
              { question: "Which browsers?", multiple: true },
            ],
          },
          output: JSON.stringify({ success: true, data: [["Staging"], ["Chrome", "Safari"]] }),
        }}
      />
    )

    expect(view.container.textContent).toContain("Answered")
    expect(view.container.textContent).not.toContain("Which environment?")
    const trigger = view.getByRole("button", { expanded: false })
    fireEvent.click(trigger)
    expect(view.container.textContent).toContain("Which environment?")
    expect(view.container.textContent).toContain("Staging")
    expect(view.container.textContent).toContain("Chrome、Safari")
    expect(trigger.getAttribute("aria-expanded")).toBe("true")
  })

  it("shows a skipped question as a static card", () => {
    const view = render(
      <ToolCallCard
        part={{
          type: "tool-question",
          toolCallId: "question-skipped",
          state: "output-available",
          input: { questions: [{ question: "Continue?" }] },
          output: { success: true, skipped: true },
        }}
      />
    )

    expect(view.container.textContent).toContain("Skipped")
    expect(view.container.textContent).not.toContain("Continue?")
    expect(view.queryByRole("button")?.hasAttribute("disabled")).toBe(true)
  })

  it("rejects invalid serialized question results instead of rendering a legacy row", () => {
    expect(() =>
      render(
        <ToolCallCard
          part={{
            type: "tool-question",
            toolCallId: "question-invalid",
            state: "output-available",
            input: { questions: [{ question: "Continue?" }] },
            output: "not-json",
          }}
        />
      )
    ).toThrow("Question result contains invalid JSON")
  })
})

describe("MCP tool call card", () => {
  it("shows the server, tool, status, input, and output", () => {
    const view = render(
      <ToolCallCard
        part={{
          type: "tool-mcp_context7_resolve_library_id",
          toolCallId: "call-mcp-1",
          state: "output-available",
          input: { libraryName: "React" },
          output: { libraryId: "/facebook/react" },
        }}
      />
    )

    expect(view.container.textContent).toContain("MCP")
    expect(view.container.textContent).toContain("context7")
    expect(view.container.textContent).toContain("resolve library id")
    expect(view.container.textContent).toContain("Completed")

    fireEvent.click(view.getByRole("button", { expanded: false }))
    expect(view.container.textContent).toContain("React")
    expect(view.container.textContent).toContain("/facebook/react")
  })

  it("renders AI SDK dynamic MCP tool parts", () => {
    const view = render(
      <ToolCallCard
        part={{
          type: "dynamic-tool",
          toolName: "mcp_shoogle_search_registry_items",
          toolCallId: "call-mcp-dynamic",
          state: "input-available",
          input: { query: "button" },
        }}
      />
    )

    expect(view.container.textContent).toContain("shoogle")
    expect(view.container.textContent).toContain("search registry items")
    expect(view.container.textContent).toContain("Running")
  })

  it("keeps dynamic MCP execution errors inside the tool card", () => {
    const view = render(
      <ToolCallCard
        part={{
          type: "dynamic-tool",
          toolName: "mcp_context7_query_docs",
          toolCallId: "call-mcp-error",
          state: "output-error",
          input: { query: "React" },
          errorText: "MCP server returned 500",
        }}
      />
    )

    fireEvent.click(view.container.querySelector("button")!)
    expect(view.container.textContent).toContain("Failed")
    expect(view.container.textContent).toContain("MCP server returned 500")
    expect(view.container.textContent).not.toContain("AI request failed")
  })
})
