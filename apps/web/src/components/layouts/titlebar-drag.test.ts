import { describe, expect, it } from "vitest"
import { isPhysicalTitlebarTarget } from "./titlebar-drag"

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
