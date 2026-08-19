import { describe, expect, it } from "vitest"
import { getPanePresentationClass } from "./editor-pane-presentation"

describe("editor pane presentation", () => {
  it("hides inactive panes with subtree compositing rather than inherited visibility", () => {
    const className = getPanePresentationClass(false)

    expect(className).toContain("opacity-0")
    expect(className).toContain("pointer-events-none")
    expect(className).not.toContain("invisible")
    expect(className).not.toContain("hidden")
  })

  it("keeps inactive panes positioned at full workspace size", () => {
    expect(getPanePresentationClass(false)).toContain("absolute inset-0")
  })


  it("preserves pane-specific layout classes", () => {
    expect(getPanePresentationClass(true, "flex bg-background")).toContain("flex bg-background")
  })
})
