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
          type: "tool-add_module",
          toolCallId: "call-1",
          state: "input-available",
          input: { modules: [{ name: "Checkout" }] },
        }}
      />
    )

    const trigger = screen.getByRole("button", { expanded: false })
    expect(trigger.hasAttribute("disabled")).toBe(false)
    fireEvent.click(trigger)
    expect(trigger.getAttribute("aria-expanded")).toBe("true")
    expect(screen.getByText(/Checkout/)).toBeTruthy()
  })
})
