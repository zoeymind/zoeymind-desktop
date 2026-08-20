// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { ErrorCard } from "./ErrorCard"
import { useAIChatV2Store } from "../../stores/useAIChatV2Store"

vi.mock("@zoeymind/i18n", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

describe("ErrorCard overflow", () => {
  beforeEach(() => {
    useAIChatV2Store.setState({ inputMessage: "", lastSentInput: "original" })
  })

  it("restores input without initiating another retry", () => {
    render(<ErrorCard code="CONTEXT_OVERFLOW" isLast />)
    expect(screen.getByText("mindmap.aiChat.error.contextOverflow.body")).toBeTruthy()
    fireEvent.click(screen.getByRole("button"))
    expect(useAIChatV2Store.getState().inputMessage).toBe("original")
    expect(useAIChatV2Store.getState().lastSentInput).toBe("")
  })
})
