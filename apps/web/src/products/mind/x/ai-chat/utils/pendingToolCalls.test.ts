import { describe, expect, it } from "vitest"
import type { UIMessage } from "@ai-sdk/react"
import {
  hasPendingToolCalls,
  interruptPendingToolParts,
  interruptTrailingPendingToolParts,
  pendingToolCallIds,
  isChatProcessing,
  isPendingToolPart,
  shouldAutoContinueAfterTools,
} from "./pendingToolCalls"

describe("pending tool call state", () => {
  it("recognizes streaming and available tool inputs", () => {
    expect(isPendingToolPart({ type: "tool-edit", state: "input-streaming" })).toBe(true)
    expect(isPendingToolPart({ type: "tool-question", state: "input-available" })).toBe(true)
    expect(isPendingToolPart({ type: "tool-read", state: "output-available" })).toBe(false)
  })

  it("derives processing from the latest assistant message when SDK status is ready", () => {
    const messages = [
      { id: "user", role: "user", parts: [] },
      {
        id: "assistant",
        role: "assistant",
        parts: [{ type: "tool-edit", toolCallId: "edit", state: "input-available", input: {} }],
      },
    ] as UIMessage[]
    expect(hasPendingToolCalls(messages)).toBe(true)
  })

  it("treats an explicitly aborted turn as idle even before SDK status settles", () => {
    const messages = [
      {
        id: "assistant-aborted",
        role: "assistant",
        parts: [
          { type: "tool-edit", toolCallId: "edit-aborted", state: "input-available", input: {} },
        ],
      },
    ] as UIMessage[]
    expect(isChatProcessing("streaming", messages, "assistant-aborted")).toBe(false)
    expect(shouldAutoContinueAfterTools(messages, "assistant-aborted")).toBe(false)
  })

  it("terminalizes every pending tool in the aborted assistant turn", () => {
    const message = {
      id: "assistant-aborted",
      role: "assistant",
      parts: [
        { type: "text", text: "partial" },
        { type: "tool-edit", toolCallId: "edit-1", state: "input-available", input: {} },
        { type: "tool-read", toolCallId: "read-1", state: "input-streaming", input: undefined },
      ],
    } as UIMessage
    const interrupted = interruptPendingToolParts(message, "执行被中断")
    expect(interrupted.parts?.slice(1)).toEqual([
      {
        type: "tool-edit",
        toolCallId: "edit-1",
        input: {},
        state: "output-error",
        errorText: "执行被中断",
      },
      {
        type: "tool-read",
        toolCallId: "read-1",
        input: undefined,
        state: "output-error",
        errorText: "执行被中断",
      },
    ])
    expect(pendingToolCallIds(message)).toEqual(["edit-1", "read-1"])
    expect(hasPendingToolCalls([interrupted])).toBe(false)
  })

  it("keeps normal pending tools active and completed tools eligible to continue", () => {
    const pending = [
      {
        id: "assistant-pending",
        role: "assistant",
        parts: [{ type: "tool-edit", toolCallId: "edit-1", state: "input-available", input: {} }],
      },
    ] as UIMessage[]
    expect(isChatProcessing("ready", pending, null)).toBe(true)
    expect(shouldAutoContinueAfterTools(pending, null)).toBe(false)

    const completed = [
      {
        id: "assistant-completed",
        role: "assistant",
        parts: [
          {
            type: "tool-edit",
            toolCallId: "edit-1",
            input: {},
            state: "output-available",
            output: { success: true },
          },
        ],
      },
    ] as UIMessage[]
    expect(shouldAutoContinueAfterTools(completed, null)).toBe(true)
  })

  it("terminalizes trailing pending tools after a stream error so the chat leaves loading", () => {
    const messages = [
      { id: "u1", role: "user", parts: [{ type: "text", text: "hi" }] },
      {
        id: "a1",
        role: "assistant",
        parts: [
          { type: "tool-edit_current_mindmap", toolCallId: "edit-1", state: "input-available" },
        ],
      },
    ] as UIMessage[]
    expect(isChatProcessing("ready", messages, null)).toBe(true)

    const cleaned = interruptTrailingPendingToolParts(messages, "TOOL_EXECUTION_INTERRUPTED")
    expect(cleaned).not.toBeNull()
    expect(isChatProcessing("ready", cleaned!, null)).toBe(false)
    // 原数组不被修改
    expect(isChatProcessing("ready", messages, null)).toBe(true)
  })

  it("returns null when there is nothing to interrupt", () => {
    const settled = [
      {
        id: "a1",
        role: "assistant",
        parts: [
          {
            type: "tool-read",
            toolCallId: "r1",
            state: "output-available",
            input: {},
            output: {},
          },
        ],
      },
    ] as UIMessage[]
    expect(interruptTrailingPendingToolParts(settled, "x")).toBeNull()
    expect(
      interruptTrailingPendingToolParts([{ id: "u1", role: "user", parts: [] }] as UIMessage[], "x")
    ).toBeNull()
  })
})
