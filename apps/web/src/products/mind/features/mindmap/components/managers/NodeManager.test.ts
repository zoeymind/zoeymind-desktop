import { describe, expect, it, vi } from "vitest"
import type { MindMapNode } from "simple-mind-map"
import { NodeManager } from "./NodeManager"

function createManager(expand: boolean) {
  const execCommand = vi.fn()
  const mindMap = { execCommand } as unknown as ConstructorParameters<typeof NodeManager>[0]
  const node = {
    getData: () => ({ expand, uid: "node-1" }),
  } as unknown as MindMapNode
  return { manager: new NodeManager(mindMap), node, execCommand }
}

describe("NodeManager.toggleFold", () => {
  it("recursively collapses an expanded subtree", () => {
    const { manager, node, execCommand } = createManager(true)

    manager.toggleFold(node)

    expect(execCommand).toHaveBeenCalledWith("UNEXPAND_ALL", false, "node-1")
  })

  it("recursively expands a collapsed subtree", () => {
    const { manager, node, execCommand } = createManager(false)

    manager.toggleFold(node)

    expect(execCommand).toHaveBeenCalledWith("EXPAND_ALL", "node-1")
  })
})
