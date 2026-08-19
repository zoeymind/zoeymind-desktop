import { describe, expect, it, vi } from "vitest"
import { createProjectSessionStore } from "./project-session-store"
import { createProjectSessionRegistry, projectSessionRegistry } from "./project-session-registry"
import {
  activateLegacyProjectSession,
  startLegacyProjectSessionAdapter,
} from "./legacy-project-session-adapter"
import { useMindMapStore } from "@/products/mind/features/mindmap/stores/mindmap-store"

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

  it("mirrors legacy runtime changes only into the active session", () => {
    const projectA = createProjectSessionStore("project-a")
    const projectB = createProjectSessionStore("project-b")
    projectSessionRegistry.register(projectA)
    projectSessionRegistry.register(projectB)
    activateLegacyProjectSession("project-a")
    const stop = startLegacyProjectSessionAdapter()
    useMindMapStore.getState().setLoading(true)
    useMindMapStore.getState().setDirty(true)

    expect(projectA.getState().dirty).toBe(true)
    expect(projectB.getState().dirty).toBe(false)

    expect(projectA.getState().lifecycle).toBe("loading")
    stop()
    projectSessionRegistry.unregister("project-a")
    activateLegacyProjectSession(null)
    projectSessionRegistry.unregister("project-b")
    useMindMapStore.getState().setDirty(false)
    useMindMapStore.getState().setLoading(false)
  })
})
