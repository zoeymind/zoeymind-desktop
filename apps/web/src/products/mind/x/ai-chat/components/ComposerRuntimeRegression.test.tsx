// @vitest-environment jsdom

import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { ActionButtons } from "./inputView/ActionButtons"
import { ContextUsageIndicator } from "./ContextUsageIndicator"

vi.mock("metal-fx", () => ({
  MetalFx: ({ children }: { children: React.ReactNode }) => children,
}))

vi.mock("@zoeymind/i18n", () => ({
  useTranslation: () => ({
    t: (key: string, values?: { value?: string }) => values?.value ?? key,
  }),
}))

describe("composer runtime regressions", () => {
  it("does not leak metallic-only props to an active send button", () => {
    render(<ActionButtons onSend={vi.fn()} onStop={vi.fn()} isSending={false} hasContent />)

    const button = screen.getByRole("button")
    expect(button.getAttribute("metalScale")).toBeNull()
    expect(button.getAttribute("metalscale")).toBeNull()
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
