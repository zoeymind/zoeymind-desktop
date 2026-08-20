import { describe, expect, it, vi } from "vitest"
import { createProjectSessionStore } from "@/products/mind/editor-session"
import { waitForMindMapInstance } from "./waitForMindMap"

describe("waitForMindMapInstance", () => {
  it("returns the MindMap owned by the supplied project session", async () => {
    const session = createProjectSessionStore("project")
    const mindMap = { id: "current-session" }
    session.getState().setMindMap(mindMap as never)

    await expect(waitForMindMapInstance(session, 10)).resolves.toBe(mindMap)
  })

  it("waits for the supplied session instead of a global active session", async () => {
    vi.useFakeTimers()
    const session = createProjectSessionStore("project")
    const mindMap = { id: "late-session" }
    const pending = waitForMindMapInstance(session, 100)

    session.getState().setMindMap(mindMap as never)
    await expect(pending).resolves.toBe(mindMap)
    vi.useRealTimers()
  })
})
