import { beforeEach, describe, expect, it } from "vitest"
import { defaultMindmapData } from "@zoeymind/shared"
import { pendingProjects } from "@/shared/native"
import { useTabs } from "@/shared/tabs/store"
import { openPendingProject } from "./useCloudProjects"

describe("empty project list creation", () => {
  beforeEach(() => {
    useTabs.setState({ tabs: [], activeId: "home" })
  })

  it("opens the pending project as an active draft tab", () => {
    const id = openPendingProject("未命名思维导图", defaultMindmapData)

    expect(pendingProjects.read(id)?.title).toBe("未命名思维导图")
    expect(useTabs.getState()).toMatchObject({
      activeId: id,
      tabs: [{ id, kind: "draft", title: "未命名思维导图" }],
    })

    pendingProjects.clear(id)
  })
})
