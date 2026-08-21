// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { CollapsibleSteps } from "./CollapsibleSteps"

vi.mock("@zoeymind/i18n", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

vi.mock("@zoeymind/ui", async importOriginal => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return { ...actual, useTheme: () => ({ resolvedTheme: "light" }) }
})

vi.mock("border-beam", () => ({
  BorderBeam: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock("../../../ai-chat/tools/registry", () => ({
  getToolLabel: (name: string) => name,
}))

describe("CollapsibleSteps active disclosure", () => {
  it("expands completed and active steps while processing", () => {
    const first = {
      type: "tool-list_modules",
      toolCallId: "call-1",
      state: "output-available" as const,
      output: { success: true },
    }
    const second = {
      type: "tool-add_module",
      toolCallId: "call-2",
      state: "input-available" as const,
      input: { modules: [{ name: "Checkout" }] },
    }
    const allParts = [first, second]

    render(
      <CollapsibleSteps
        toolParts={allParts.map((part, index) => ({ part, index }))}
        isProcessing
        turnStartedAt={Date.now() - 5_000}
        allParts={allParts}
        lastActivePartIndex={1}
        renderPart={(_part, index) => <div>rendered-step-{index}</div>}
      />
    )

    const trigger = screen.getByRole("button")
    expect(trigger.getAttribute("aria-expanded")).toBe("false")
    fireEvent.click(trigger)
    expect(trigger.getAttribute("aria-expanded")).toBe("true")
    expect(screen.getByText("rendered-step-0")).toBeTruthy()
  })
})
