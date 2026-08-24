// @vitest-environment jsdom

import { render, screen } from "@testing-library/react"
import type { ComponentProps, ReactNode } from "react"
import { describe, expect, it, vi } from "vitest"
import { ActionButtons } from "./inputView/ActionButtons"
import { ContextUsageIndicator } from "./ContextUsageIndicator"

vi.mock("metal-fx", () => ({
  MetalFx: ({ children }: { children: React.ReactNode }) => children,
}))
vi.mock("@zoeymind/ui", async importOriginal => {
  const actual = await importOriginal<typeof import("@zoeymind/ui")>()
  return {
    ...actual,
    MetallicButton: ({
      metalTheme,
      metalScale,
      children,
      ...props
    }: ComponentProps<"button"> & {
      metalTheme?: "dark" | "light" | "auto"
      metalScale?: number
      children?: ReactNode
    }) => (
      <button
        data-slot="metallic-button"
        data-metal-theme={metalTheme}
        data-metal-scale={metalScale}
        {...props}
      >
        {children}
      </button>
    ),
    useTheme: () => ({ resolvedTheme: "dark" as const }),
  }
})

vi.mock("@zoeymind/i18n", () => ({
  useTranslation: () => ({
    t: (key: string, values?: { value?: string }) => values?.value ?? key,
  }),
}))

describe("composer runtime regressions", () => {
  it("keeps metallic rendering props off the underlying send button", () => {
    render(<ActionButtons onSend={vi.fn()} onStop={vi.fn()} isSending={false} hasContent />)

    const button = screen.getByRole("button")
    expect(button.dataset.slot).toBe("metallic-button")
    expect(button.dataset.metalTheme).toBe("dark")
    expect(button.dataset.metalScale).toBe("0.5")
    expect(button.getAttribute("metalTheme")).toBeNull()
    expect(button.getAttribute("metalScale")).toBeNull()
    expect(button.getAttribute("metalscale")).toBeNull()
  })

  it("uses semantic theme tokens for every send-button state", () => {
    const { container, rerender } = render(
      <ActionButtons onSend={vi.fn()} onStop={vi.fn()} isSending={false} hasContent />
    )
    const button = () => container.querySelector("button") as HTMLButtonElement
    expect(button().className).toContain("bg-primary")
    expect(button().className).toContain("text-primary-foreground")

    rerender(<ActionButtons onSend={vi.fn()} onStop={vi.fn()} isSending hasContent={false} />)
    expect(button().className).toContain("bg-secondary")
    expect(button().className).toContain("text-secondary-foreground")

    rerender(<ActionButtons onSend={vi.fn()} isSending={false} hasContent={false} />)
    expect(button().className).toContain("bg-muted")
    expect(button().className).toContain("text-muted-foreground")
  })

  it("normalizes missing token values instead of crashing the chat tree", () => {
    render(
      <ContextUsageIndicator
        usedTokens={undefined as unknown as number}
        maxTokens={undefined as unknown as number}
      />
    )

    expect(screen.getByRole("button", { name: "0.0% · 0/0" })).toBeTruthy()
  })
})
