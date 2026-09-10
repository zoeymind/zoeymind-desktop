// @vitest-environment jsdom
import { renderHook } from "@testing-library/react"
import { expect, it, vi } from "vitest"
import { useStorageManager } from "./useStorageManager"
const native = vi.hoisted(() => ({ getProject: vi.fn(), readBundle: vi.fn() }))
vi.mock("./useCanvasManager", () => ({ defaultData: { data: { text: "default" }, children: [] } }))
vi.mock("@/products/mind/editor-session", () => ({
  useProjectMindMapStore: () => ({ mindMap: null }),
}))
vi.mock("@/products/mind/features/mindmap/contexts/project-context", () => ({
  useProjectContext: () => ({ workspaceId: "unsaved-tab" }),
}))
vi.mock("@/shared/native", () => ({
  ...native,
  pendingProjects: { isPending: () => false },
  useOptionalSaveFlow: () => ({}),
}))
vi.mock("@/shared/tabs/store", () => ({
  useTabs: {
    getState: () => ({ tabs: [{ id: "unsaved-tab", projectId: "saved-project", kind: "file" }] }),
  },
}))

it("loads the formal project after a saved draft pane remounts with its original tab id", async () => {
  const tree = { data: { text: "saved cases" }, children: [] }
  native.getProject.mockImplementation(async id =>
    id === "saved-project" ? { exists: true, path: "/saved.zmind" } : null
  )
  native.readBundle.mockResolvedValue({ tree })
  const { result, unmount } = renderHook(() => useStorageManager())
  expect(await result.current.loadSavedData()).toEqual({ savedData: tree, savedViewData: null })
  unmount()
})
