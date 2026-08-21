import { describe, expect, it, vi } from "vitest"
import { createProjectSessionStore } from "./project-session-store"
import { createProjectSessionRegistry } from "./project-session-registry"

describe("Project Editor Session", () => {
  it("keeps runtime state isolated between open projects", () => {
    const projectA = createProjectSessionStore("project-a")
    const projectB = createProjectSessionStore("project-b")
    const mindMapA = { workspaceId: "project-a" } as never
    const mindMapB = { workspaceId: "project-b" } as never

    projectA.getState().setMindMap(mindMapA)
    projectA.getState().setDirty(true)
    projectA.getState().setLifecycle("ready")
    projectB.getState().setMindMap(mindMapB)

    expect(projectA.getState()).toMatchObject({
      projectId: "project-a",
      mindMap: mindMapA,
      dirty: true,
      lifecycle: "ready",
    })
    expect(projectB.getState()).toMatchObject({
      projectId: "project-b",
      mindMap: mindMapB,
      dirty: false,
      lifecycle: "idle",
    })
  })

  it("registers stable sessions and disposes only the closed project", () => {
    const registry = createProjectSessionRegistry()
    const projectA = createProjectSessionStore("project-a")
    const projectB = createProjectSessionStore("project-b")
    const disposeA = vi.fn()
    const disposeB = vi.fn()
    projectA.getState().setCommands({ dispose: disposeA })
    projectB.getState().setCommands({ dispose: disposeB })

    registry.register(projectA)
    registry.register(projectB)
    registry.setActive("project-b")

    expect(registry.get("project-a")).toBe(projectA)
    expect(registry.getActive()).toBe(projectB)

    registry.unregister("project-a")

    expect(disposeA).toHaveBeenCalledOnce()
    expect(disposeB).not.toHaveBeenCalled()
    expect(registry.get("project-a")).toBeUndefined()
    expect(registry.getActive()).toBe(projectB)
  })

  it("preserves the active identity while its session remounts", () => {
    const registry = createProjectSessionRegistry()
    const first = createProjectSessionStore("project-a")
    const remounted = createProjectSessionStore("project-a")
    registry.register(first)
    registry.setActive("project-a")

    registry.unregister("project-a")
    registry.register(remounted)

    expect(registry.getActive()).toBe(remounted)
  })

  it("publishes state changes from every registered project", () => {
    const registry = createProjectSessionRegistry()
    const projectA = createProjectSessionStore("project-a")
    const projectB = createProjectSessionStore("project-b")
    const notify = vi.fn()
    const unsubscribe = registry.subscribe(notify)
    registry.register(projectA)
    registry.register(projectB)

    projectA.getState().setDirty(true)
    projectB.getState().setDirty(true)

    expect(notify).toHaveBeenCalledTimes(4)
    expect(registry.getRevision()).toBe(4)
    unsubscribe()
  })
})

describe("recovered editor session", () => {
  it("starts dirty so recovered content cannot be closed as a clean file", () => {
    const recovered = createProjectSessionStore("recovered-tab", { dirty: true })

    expect(recovered.getState().dirty).toBe(true)
  })
})
