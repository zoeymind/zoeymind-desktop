import { describe, expect, it } from "vitest"
import { getTitlebarMouseAction, isPhysicalTitlebarTarget } from "./titlebar-drag"

describe("titlebar drag boundary", () => {
  const titlebar = {
    contains: (target: Node) => target === physicalChild,
  } as unknown as Node
  const physicalChild = {} as Node
  const portalChild = {} as Node

  it("accepts elements physically rendered inside the titlebar", () => {
    expect(isPhysicalTitlebarTarget(titlebar, physicalChild)).toBe(true)
  })

  it("rejects dialog portal content that only bubbles through the React tree", () => {
    expect(isPhysicalTitlebarTarget(titlebar, portalChild)).toBe(false)
  })
})

describe("titlebar mouse action", () => {
  it("toggles maximize on the second left-button mousedown", () => {
    expect(getTitlebarMouseAction(1, 2)).toBe("toggle-maximize")
  })

  it("starts dragging on the first left-button mousedown", () => {
    expect(getTitlebarMouseAction(1, 1)).toBe("start-dragging")
  })

  it("ignores non-left-button mouse events", () => {
    expect(getTitlebarMouseAction(2, 2)).toBeNull()
  })
})
