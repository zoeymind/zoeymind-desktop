// @vitest-environment jsdom

import { act, fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { ButtonHTMLAttributes } from "react"
import { useUIStore } from "@/products/mind/stores"
import { AIChatToggle } from "./FormatPanel"

vi.mock("@zoeymind/i18n", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

vi.mock("@/shared/app-shared", () => ({
  useFeature: () => true,
}))

vi.mock("@zoeymind/ui", async importOriginal => {
  const actual = await importOriginal<typeof import("@zoeymind/ui")>()
  return {
    ...actual,
    MetallicButton: ({
      children,
      className,
      metalPaused,
      ...props
    }: ButtonHTMLAttributes<HTMLButtonElement> & {
      metalPaused?: boolean
      metalTheme?: string
    }) => {
      const { metalTheme, ...buttonProps } = props
      void metalTheme
      return (
        <div data-testid="metal-fx-root" data-paused={metalPaused ? "true" : "false"}>
          <button
            data-slot="metallic-button"
            className={`cursor-pointer ${className ?? ""}`}
            {...buttonProps}
          >
            {children}
          </button>
        </div>
      )
    },
    useTheme: () => ({ resolvedTheme: "light" as const }),
  }
})

describe("AIChatToggle", () => {
  beforeEach(() => {
    useUIStore.getState().closeFormatTab()
  })

  it("opens the AI panel and restores the shared metallic entry after close", () => {
    const { container } = render(<AIChatToggle />)
    const metalRoot = screen.getByTestId("metal-fx-root")
    const button = screen.getByRole("button", { name: "mindmap.formatPanel.toolbar.aiAssistant" })

    expect(button.dataset.slot).toBe("metallic-button")
    expect(button.classList.contains("cursor-pointer")).toBe(true)
    expect(button).not.toHaveProperty("disabled", true)

    fireEvent.click(button)

    expect(useUIStore.getState().activeFormatTab).toBe("ai")
    expect(screen.getByTestId("metal-fx-root")).toBe(metalRoot)
    expect(metalRoot.dataset.paused).toBe("true")
    expect(container.firstElementChild?.classList.contains("invisible")).toBe(true)
    expect(container.firstElementChild?.classList.contains("pointer-events-none")).toBe(true)
    expect(container.firstElementChild?.classList.contains("w-0")).toBe(false)
    expect(container.firstElementChild?.hasAttribute("inert")).toBe(true)

    act(() => useUIStore.getState().closeFormatTab())

    const restoredButton = screen.getByRole("button", {
      name: "mindmap.formatPanel.toolbar.aiAssistant",
    })
    expect(screen.getByTestId("metal-fx-root")).toBe(metalRoot)
    expect(metalRoot.dataset.paused).toBe("false")
    expect(container.firstElementChild?.classList.contains("visible")).toBe(true)
    expect(container.firstElementChild?.classList.contains("opacity-100")).toBe(true)
    expect(container.firstElementChild?.hasAttribute("inert")).toBe(false)
    expect(restoredButton.dataset.slot).toBe("metallic-button")
    expect(restoredButton).not.toHaveProperty("disabled", true)
  })
})
