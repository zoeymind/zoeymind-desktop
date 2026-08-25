// @vitest-environment jsdom
import { render } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { MessageScroller } from "./message-scroller"

vi.mock("motion/react", () => ({ useReducedMotion: () => false }))

describe("MessageScroller native wheel behavior", () => {
  it("does not intercept wheel events from the message list", () => {
    const view = render(<MessageScroller label="Conversation">message</MessageScroller>)
    const viewport = view.getByLabelText("Conversation")
    const event = new WheelEvent("wheel", { deltaY: 100, bubbles: true, cancelable: true })

    viewport.dispatchEvent(event)

    expect(event.defaultPrevented).toBe(false)
  })

  it("does not intercept wheel events from nested card scrollers", () => {
    const view = render(
      <MessageScroller label="Conversation">
        <div data-testid="card-scroll" className="overflow-y-auto">
          card content
        </div>
      </MessageScroller>
    )
    const cardScroller = view.getByTestId("card-scroll")
    const event = new WheelEvent("wheel", { deltaY: 100, bubbles: true, cancelable: true })

    cardScroller.dispatchEvent(event)

    expect(event.defaultPrevented).toBe(false)
  })
})
