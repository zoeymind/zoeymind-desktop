// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { CompactSummaryCard } from "./CompactSummaryCard"

vi.mock("@zoeymind/i18n", () => ({
  useTranslation: () => ({
    t: (key: string, values?: { count?: number; model?: string }) =>
      key.includes("bannerTitle")
        ? "Conversation compacted"
        : key.includes("bannerCount")
          ? `${values?.count} messages`
          : key.includes("modelHint")
            ? `Model ${values?.model}`
            : key,
  }),
}))

describe("CompactSummaryCard", () => {
  beforeEach(() => document.body.replaceChildren())

  it("renders metadata and expands the persisted summary", () => {
    render(
      <CompactSummaryCard text={"## Summary\n\nKept facts"} compactedCount={4} modelId="local" />
    )
    expect(screen.getByText("Conversation compacted")).toBeTruthy()
    expect(screen.getByText("· 4 messages")).toBeTruthy()
    fireEvent.click(screen.getByRole("button"))
    expect(screen.getByText("Kept facts")).toBeTruthy()
    expect(screen.getByText("Model local")).toBeTruthy()
  })
})
