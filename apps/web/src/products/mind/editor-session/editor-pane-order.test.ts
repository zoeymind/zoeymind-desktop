import { describe, expect, it } from "vitest"
import { reconcileEditorPaneOrder } from "./editor-pane-order"

describe("editor pane runtime order", () => {
  it("does not move mounted editor runtimes when tab labels are reordered", () => {
    expect(
      reconcileEditorPaneOrder(["project-a", "project-b"], ["project-b", "project-a"])
    ).toEqual(["project-a", "project-b"])
  })

  it("preserves the order reference when open projects are unchanged", () => {
    const current = ["project-a", "project-b"]
    expect(reconcileEditorPaneOrder(current, ["project-b", "project-a"])).toBe(current)
  })

  it("adds newly opened projects and removes closed projects", () => {
    expect(
      reconcileEditorPaneOrder(["project-a", "project-b"], ["project-c", "project-b"])
    ).toEqual(["project-b", "project-c"])
  })
})
