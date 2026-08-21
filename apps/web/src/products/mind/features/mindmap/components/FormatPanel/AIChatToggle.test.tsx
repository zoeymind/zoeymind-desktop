// @vitest-environment jsdom

import { act, fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { ReactNode } from "react"
import { useUIStore } from "@/products/mind/stores"
import { AIChatToggle } from "./FormatPanel"
vi.mock("metal-fx", () => ({
  MetalFx: ({ children }: { children: ReactNode }) => children,
}))

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
    useTheme: () => ({ resolvedTheme: "light" as const }),
  }
})

describe("AIChatToggle", () => {
  beforeEach(() => {
    useUIStore.getState().closeFormatTab()
  })

  it("opens the AI panel and restores the shared metallic entry after close", () => {
    const { container } = render(<AIChatToggle />)
    const button = screen.getByRole("button", { name: "mindmap.formatPanel.toolbar.aiAssistant" })

    expect(button.dataset.slot).toBe("metallic-button")
    expect(button.classList.contains("cursor-pointer")).toBe(true)
    expect(button).not.toHaveProperty("disabled", true)

    fireEvent.click(button)

    expect(useUIStore.getState().activeFormatTab).toBe("ai")
    expect(container.firstElementChild?.classList.contains("w-0")).toBe(true)
    expect(container.firstElementChild?.classList.contains("opacity-0")).toBe(true)
    expect(container.firstElementChild?.classList.contains("pointer-events-none")).toBe(true)

    act(() => useUIStore.getState().closeFormatTab())

    const restoredButton = screen.getByRole("button", {
      name: "mindmap.formatPanel.toolbar.aiAssistant",
    })
    expect(container.firstElementChild?.classList.contains("w-auto")).toBe(true)
    expect(container.firstElementChild?.classList.contains("opacity-100")).toBe(true)
    expect(restoredButton.dataset.slot).toBe("metallic-button")
    expect(restoredButton).not.toHaveProperty("disabled", true)
  })
})
