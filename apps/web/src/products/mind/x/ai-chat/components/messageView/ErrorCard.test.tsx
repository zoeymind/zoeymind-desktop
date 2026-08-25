// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { ErrorCard } from "./ErrorCard"
import { useAIChatV2Store } from "../../stores/useAIChatV2Store"

vi.mock("@zoeymind/i18n", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

describe("ErrorCard", () => {
  beforeEach(() => {
    useAIChatV2Store.setState({ inputMessage: "", lastSentInput: "original" })
  })

  it("expands and hides the provider error message", () => {
    render(
      <ErrorCard error={{ code: "REQUEST_FAILED", message: "Provider request failed" }} isLast />
    )

    const trigger = screen.getByText("mindmap.aiChat.error.requestFailed.title").closest("button")
    expect(trigger?.getAttribute("aria-expanded")).toBe("true")
    expect(screen.getByText("Provider request failed")).toBeTruthy()

    fireEvent.click(trigger!)
    expect(trigger?.getAttribute("aria-expanded")).toBe("false")
  })

  it("restores the input without sending another request", () => {
    render(<ErrorCard error={{ code: "CONTEXT_OVERFLOW" }} isLast />)
    fireEvent.click(screen.getByText("mindmap.aiChat.error.contextOverflow.cta"))
    expect(useAIChatV2Store.getState().inputMessage).toBe("original")
    expect(useAIChatV2Store.getState().lastSentInput).toBe("")
  })
})
