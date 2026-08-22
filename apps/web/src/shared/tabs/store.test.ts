import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/shared/app-shared/loading", () => ({
  useLoadingStore: { getState: () => ({ showLoading: vi.fn() }) },
}))
vi.mock("./loading", () => ({
  useTabLoading: { getState: () => ({ setLoading: vi.fn(), clear: vi.fn() }) },
}))

import { partializeTabsForPersist, useTabs } from "./store"

describe("project tab rename", () => {
  beforeEach(() => {
    useTabs.setState({
      activeId: "draft-tab",
      tabs: [
        {
          id: "draft-tab",
          kind: "file",
          title: "Old name",
          projectId: "project-1",
        },
        {
          id: "project-2",
          kind: "file",
          title: "Other project",
          projectId: "project-2",
        },
      ],
    })
  })

  it("renames a persisted file tab by its backing project id", () => {
    useTabs.getState().renameProjectTabs("project-1", "New name")

    expect(useTabs.getState().tabs.map(tab => tab.title)).toEqual(["New name", "Other project"])
  })
})

describe("tabs persist partialize", () => {
  /**
   * 未修 partialize 前 tab.id 是运行期 tempId (unsaved-xxx), 持久化后重启
   * 走 pendingProjects.isPending 前缀分支, 内存 store 已空 -> loadSavedData
   * 兜底成空画布. 归一化到 projectId 后重启能正常从磁盘加载.
   */
  it("normalizes tempId tabs to projectId for persistence", () => {
    const persisted = partializeTabsForPersist({
      activeId: "unsaved-abc",
      tabs: [
        { id: "unsaved-abc", kind: "file", title: "Promoted draft", projectId: "real-1" },
        { id: "unsaved-xyz", kind: "draft", title: "Still unsaved" },
        { id: "real-2", kind: "file", title: "Direct open", projectId: "real-2" },
      ],
    })
    expect(persisted).toEqual({
      activeId: "real-1",
      tabs: [
        { id: "real-1", kind: "file", title: "Promoted draft", projectId: "real-1" },
        { id: "real-2", kind: "file", title: "Direct open", projectId: "real-2" },
      ],
    })
  })

  it("keeps home as active when nothing needs remapping", () => {
    const persisted = partializeTabsForPersist({
      activeId: "home",
      tabs: [{ id: "real-1", kind: "file", title: "x", projectId: "real-1" }],
    })
    expect(persisted.activeId).toBe("home")
  })
})
