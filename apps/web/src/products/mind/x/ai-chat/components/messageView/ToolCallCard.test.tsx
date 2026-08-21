// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { ToolCallCard } from "./ToolCallCard"

vi.mock("@zoeymind/i18n", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

vi.mock("../../../ai-chat/tools/registry", () => ({
  getToolLabel: (name: string) => name,
}))

describe("ToolCallCard active disclosure", () => {
  it("expands input while the tool is still executing", () => {
    render(
      <ToolCallCard
        part={{
          type: "tool-edit",
          toolCallId: "call-1",
          state: "input-available",
          input: { anchorTag: "a", patch: "update" },
        }}
      />
    )

    const trigger = screen.getByRole("button", { expanded: false })
    expect(trigger.hasAttribute("disabled")).toBe(false)
    fireEvent.click(trigger)
    expect(trigger.getAttribute("aria-expanded")).toBe("true")
    expect(screen.getByText(/anchorTag/)).toBeTruthy()
  })
})
