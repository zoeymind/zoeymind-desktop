// @vitest-environment jsdom
import { act, cleanup, fireEvent, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { MessageScroller } from "./message-scroller"

vi.mock("motion/react", () => ({ useReducedMotion: () => false }))

describe("MessageScroller wheel motion", () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it("continues mouse-wheel scrolling with decaying motion", () => {
    let frame: FrameRequestCallback | undefined
    vi.spyOn(window, "requestAnimationFrame").mockImplementation(callback => {
      frame = callback
      return 1
    })
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => undefined)
    vi.spyOn(performance, "now").mockReturnValue(100)

    const view = render(<MessageScroller label="Conversation">message</MessageScroller>)
    const viewport = view.getByLabelText("Conversation")
    Object.defineProperties(viewport, {
      clientHeight: { configurable: true, value: 200 },
      scrollHeight: { configurable: true, value: 2_000 },
    })

    const event = new WheelEvent("wheel", { deltaY: 100, cancelable: true })
    viewport.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(true)
    expect(frame).toBeTypeOf("function")

    act(() => frame?.(116))
    expect(viewport.scrollTop).toBeGreaterThan(0)
    const firstPosition = viewport.scrollTop
    act(() => frame?.(132))
    expect(viewport.scrollTop).toBeGreaterThan(firstPosition)
  })

  it("leaves small rapid trackpad deltas to native momentum", () => {
    vi.spyOn(performance, "now").mockReturnValueOnce(100).mockReturnValueOnce(110)
    const view = render(<MessageScroller label="Conversation">message</MessageScroller>)
    const viewport = view.getByLabelText("Conversation")

    fireEvent.wheel(viewport, { deltaY: 10 })
    const event = new WheelEvent("wheel", { deltaY: 10, cancelable: true })
    viewport.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(false)
  })

  it("lets a nested tool scroller consume the wheel until it reaches an edge", () => {
    const view = render(
      <MessageScroller label="Conversation">
        <div data-testid="tool-scroll" style={{ overflowY: "auto" }}>
          tool output
        </div>
      </MessageScroller>
    )
    const viewport = view.getByLabelText("Conversation")
    const toolScroller = view.getByTestId("tool-scroll")
    Object.defineProperties(viewport, {
      clientHeight: { configurable: true, value: 200 },
      scrollHeight: { configurable: true, value: 2_000 },
    })
    Object.defineProperties(toolScroller, {
      clientHeight: { configurable: true, value: 100 },
      scrollHeight: { configurable: true, value: 500 },
    })
    toolScroller.scrollTop = 50

    const innerEvent = new WheelEvent("wheel", { deltaY: -100, bubbles: true, cancelable: true })
    toolScroller.dispatchEvent(innerEvent)
    expect(innerEvent.defaultPrevented).toBe(false)

    toolScroller.scrollTop = 0
    const boundaryEvent = new WheelEvent("wheel", {
      deltaY: -100,
      bubbles: true,
      cancelable: true,
    })
    toolScroller.dispatchEvent(boundaryEvent)
    expect(boundaryEvent.defaultPrevented).toBe(true)
  })
})
