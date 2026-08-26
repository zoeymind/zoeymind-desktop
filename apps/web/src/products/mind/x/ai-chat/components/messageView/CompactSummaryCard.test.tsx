// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { CompactSummaryCard } from "./CompactSummaryCard"

vi.mock("@zoeymind/i18n", () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, string | number | undefined>) =>
      key.includes("bannerTitle")
        ? "Conversation compacted"
        : key.includes("bannerCount")
          ? `${values?.count} messages`
          : key.includes("modelHint")
            ? `Model ${values?.model}`
            : key.includes("tokenMetrics")
              ? `${values?.before} -> ${values?.after} tokens`
              : key.includes("durationMetric")
                ? `${values?.seconds}s`
                : key,
  }),
}))

describe("CompactSummaryCard", () => {
  beforeEach(() => document.body.replaceChildren())

  it("renders metadata and expands the persisted summary", () => {
    render(
      <CompactSummaryCard
        text={"## Summary\n\nKept facts"}
        compactedCount={4}
        modelId="local"
        tokensBefore={12_000}
        tokensAfter={3_000}
        durationMs={2_500}
      />
    )
    expect(screen.getByText("Conversation compacted")).toBeTruthy()
    expect(screen.getByText("· 4 messages")).toBeTruthy()
    expect(screen.getByText("· 12,000 -> 3,000 tokens")).toBeTruthy()
    expect(screen.getByText("· 2.5s")).toBeTruthy()
    fireEvent.click(screen.getByRole("button"))
    expect(screen.getByText("Kept facts")).toBeTruthy()
    expect(screen.getByText("Model local")).toBeTruthy()
  })
})
