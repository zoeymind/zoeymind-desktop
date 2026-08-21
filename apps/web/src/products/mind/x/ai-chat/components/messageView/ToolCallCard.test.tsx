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
