// @vitest-environment jsdom

import { render } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { Slider } from "@zoeymind/ui"

describe("Slider track", () => {
  it("renders a visible semantic horizontal track and range", () => {
    const { container } = render(<Slider value={[3]} min={0} max={10} aria-label="Recall count" />)

    const track = container.querySelector('[data-slot="slider-track"]')
    const range = container.querySelector('[data-slot="slider-range"]')

    expect(track?.className).toContain("h-1")
    expect(track?.className).toContain("w-full")
    expect(track?.className).toContain("bg-muted")
    expect(range?.className).toContain("h-full")
    expect(range?.className).toContain("bg-primary")
    expect(track?.className).not.toContain("data-horizontal:")
  })
})
