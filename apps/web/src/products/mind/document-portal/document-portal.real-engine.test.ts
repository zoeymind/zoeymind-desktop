// @vitest-environment jsdom

import MindMap, { type MindMapNodeTree } from "simple-mind-map"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"
import {
  PROJECT_SESSION_LIFECYCLE,
  createProjectSessionRegistry,
  createProjectSessionStore,
} from "@/products/mind/editor-session"
import type { OpenTab } from "@/shared/tabs/store"
import { createMindMapDocumentPortal } from "./mindmap-document-portal"

const maps: MindMap[] = []

beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, "clientWidth", {
    configurable: true,
    get: () => 1_000,
  })
  Object.defineProperty(HTMLElement.prototype, "clientHeight", {
    configurable: true,
    get: () => 800,
  })
  Object.defineProperty(SVGElement.prototype, "getBBox", {
    configurable: true,
    value: () => ({ x: 0, y: 0, width: 100, height: 30 }),
  })
  Object.defineProperty(SVGElement.prototype, "getComputedTextLength", {
    configurable: true,
    value: () => 80,
  })
  const originalCreateRange = document.createRange.bind(document)
  document.createRange = () => {
    const range = originalCreateRange()
    Object.defineProperty(range, "getBoundingClientRect", {
      configurable: true,
      value: () => ({
        x: 0,
        y: 0,
        top: 0,
        left: 0,
        right: 80,
        bottom: 20,
        width: 80,
        height: 20,
        toJSON: () => ({}),
      }),
    })
    return range
  }
})
afterEach(() => {
  vi.useRealTimers()
  for (const map of maps.splice(0)) map.destroy()
  document.body.replaceChildren()
})

function createLivePortal(options: { includeStep?: boolean } = {}) {
  const element = document.createElement("div")
  document.body.append(element)
  Object.defineProperty(element, "getBoundingClientRect", {
    configurable: true,
    value: () => ({
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: 1_000,
      bottom: 800,
      width: 1_000,
      height: 800,
      toJSON: () => ({}),
    }),
  })
  const root: MindMapNodeTree = {
    data: { uid: "root", text: "Root" },
    children: [
      {
        data: { uid: "module-a", text: "Module A", icon: ["sign_2"] },
        children: [
          {
            data: {
              uid: "case-a",
              text: "Case A & Ready",
              icon: ["priority_1"],
              note: "keep this note",
              hyperlink: "https://example.test/case-a",
              customFlag: "preserve-me",
            },
            children: options.includeStep
              ? [{ data: { uid: "step-a", text: "Open A & A opens" }, children: [] }]
              : [],
          },
          {
            data: { uid: "case-b", text: "Case B & Ready", icon: ["priority_1"] },
            children: [],
          },
        ],
      },
      {
        data: { uid: "module-b", text: "Module B", icon: ["sign_2"] },
        children: [],
      },
    ],
  }
  const mindMap = new MindMap({
    el: element,
    width: 1_000,
    height: 800,
    data: root,
    addHistoryOnInit: true,
    addHistoryTime: 100,
  })
  maps.push(mindMap)
  const registry = createProjectSessionRegistry()
  const session = createProjectSessionStore("patches")
  session.getState().setLifecycle(PROJECT_SESSION_LIFECYCLE.READY)
  session.getState().setMindMap(mindMap)
  registry.register(session)
  const tabs: OpenTab[] = [{ id: "patches", kind: "file", title: "Patches" }]
  const portal = createMindMapDocumentPortal({
    registry,
    getTabs: () => ({ tabs, activeId: "patches" }),
  })
  return { mindMap, portal, session }
}

function childTexts(root: MindMapNodeTree, module: string): string[] {
  return (
    root.children
      .find(node => node.data.text === module)
      ?.children.map(node => String(node.data.text)) ?? []
  )
}

function largeCommentFeaturePatch(): string {
  const rows = ["PUT 1.=6:", "+朋友圈首页", "+  # 评论功能"]
  for (let group = 1; group <= 5; group += 1) {
    rows.push(`+    # 评论区域${group}`, `+      # 交互控件${group}`, `+        # 通用行为${group}`)
    for (let testCase = 1; testCase <= 9; testCase += 1) {
      rows.push(
        `+          [P${(testCase % 3) + 1}]评论场景${group}-${testCase} & 已满足前置条件`,
        `+            执行评论操作${group}-${testCase} & 显示可观察结果${group}-${testCase}`
      )
    }
  }
  return rows.join("\n")
}
function commentFeaturePatch(options: { rangeEnd: number; includeSteps: boolean }): string {
  const rows = [`PUT 1.=${options.rangeEnd}:`, "+朋友圈首页", "+  # 评论功能"]
  for (let group = 1; group <= 5; group += 1) {
    rows.push(`+    # 评论区域${group}`, `+      # 交互控件${group}`, `+        # 通用行为${group}`)
    for (let testCase = 1; testCase <= 9; testCase += 1) {
      rows.push(`+          [P${(testCase % 3) + 1}]评论场景${group}-${testCase} & 已满足前置条件`)
      if (options.includeSteps) {
        rows.push(
          `+            执行评论操作${group}-${testCase} & 显示可观察结果${group}-${testCase}`
        )
      }
    }
  }
  return rows.join("\n")
}

describe("DocumentPortal with the real MindMap engine", () => {
  it("commits one independent undo entry even when a user history timer is pending", async () => {
    vi.useFakeTimers()
    const { mindMap, portal } = createLivePortal()
    await vi.advanceTimersByTimeAsync(100)
    const caseNode = mindMap.renderer.findNodeByUid("case-a")!
    mindMap.execCommand("SET_NODE_TEXT", caseNode, "User edit & Ready")
    const read = portal.read({ documentId: "patches", view: "subtree", path: ["Module A"] })
    const edit = portal.edit({
      documentId: "patches",
      anchorTag: read.anchorTag,
      patch: "PUT 2.=2:\n+[P1] Portal edit & Ready",
    })
    await vi.runAllTimersAsync()
    await edit

    expect(childTexts(mindMap.getData(), "Module A")).toEqual([
      "Portal edit & Ready",
      "Case B & Ready",
    ])
    mindMap.execCommand("BACK")
    expect(childTexts(mindMap.getData(), "Module A")).toEqual([
      "User edit & Ready",
      "Case B & Ready",
    ])
  })

  it("restores a move exactly when a later real engine command fails before render refresh", async () => {
    vi.useFakeTimers()
    const { mindMap, portal, session } = createLivePortal()
    await vi.advanceTimersByTimeAsync(100)
    const before = mindMap.getData()
    const read = portal.read({ documentId: "patches", view: "subtree" })
    const execute = mindMap.execCommand.bind(mindMap)
    let patchCommandCount = 0
    vi.spyOn(mindMap, "execCommand").mockImplementation((command, ...args) => {
      if (command === "PATCH_NODE_DATA_TREE" && ++patchCommandCount === 1) {
        const apply = args[0] as (root: MindMapNodeTree) => void
        return execute(command, (root: MindMapNodeTree) => {
          apply(root)
          throw new Error("injected engine failure")
        })
      }
      return execute(command, ...args)
    })

    const edit = portal.edit({
      documentId: "patches",
      anchorTag: read.anchorTag,
      patch: "MOVE 3 -> 5:\nPUT 4.=4:\n+[P1] Updated & Ready",
    })
    await vi.runAllTimersAsync()
    await expect(edit).rejects.toThrow("injected engine failure")

    expect(mindMap.getData()).toEqual(before)
    expect(session.getState().dirty).toBe(false)
  })

  it("reads real module and case structure without leaking steps into outline", async () => {
    vi.useFakeTimers()
    const { portal } = createLivePortal({ includeStep: true })
    await vi.advanceTimersByTimeAsync(100)

    const outline = portal.read({ documentId: "patches", view: "outline" })
    expect(outline.content).toContain("2:   # Module A")
    expect(outline.content).toContain("3:     [P1] Case A & Ready")
    expect(outline.content).not.toContain("Open A")

    const subtree = portal.read({
      documentId: "patches",
      view: "subtree",
      path: ["Module A", "Case A & Ready"],
    })
    expect(subtree.content).toContain("2:   Open A & A opens")
  })

  it("applies and undoes an inserted real subtree with stable domain data", async () => {
    vi.useFakeTimers()
    const { mindMap, portal } = createLivePortal()
    await vi.advanceTimersByTimeAsync(100)
    const before = mindMap.getData()
    const read = portal.read({ documentId: "patches", view: "subtree", path: ["Module A"] })

    const edit = portal.edit({
      documentId: "patches",
      anchorTag: read.anchorTag,
      patch: "PUT >3:\n+[P2] Added & Ready\n+  Run action & Observe result",
    })
    await vi.runAllTimersAsync()
    await edit

    const module = mindMap.getData().children[0]!
    expect(module.children.map(node => node.data.text)).toEqual([
      "Case A & Ready",
      "Case B & Ready",
      "Added & Ready",
    ])
    expect(module.children[2]?.children[0]?.data.text).toBe("Run action & Observe result")
    mindMap.execCommand("BACK")
    expect(mindMap.getData()).toEqual(before)
  })

  it("restores complete metadata after a real structural replacement fails", async () => {
    vi.useFakeTimers()
    const { mindMap, portal, session } = createLivePortal()
    await vi.advanceTimersByTimeAsync(100)
    const before = mindMap.getData()
    const read = portal.read({ documentId: "patches", view: "subtree" })
    const patch =
      "PUT 3.=3:\n+[P2] Replacement & Ready\n+  Act & Observe\nPUT 4.=4:\n+[P1] Updated & Ready"
    const preview = await portal.edit({
      documentId: "patches",
      anchorTag: read.anchorTag,
      patch,
      preview: true,
    })
    const execute = mindMap.execCommand.bind(mindMap)
    let patchCommandCount = 0
    vi.spyOn(mindMap, "execCommand").mockImplementation((command, ...args) => {
      if (command === "PATCH_NODE_DATA_TREE" && ++patchCommandCount === 1) {
        const apply = args[0] as (root: MindMapNodeTree) => void
        return execute(command, (root: MindMapNodeTree) => {
          apply(root)
          throw new Error("injected engine failure")
        })
      }
      return execute(command, ...args)
    })

    const edit = portal.edit({
      documentId: "patches",
      anchorTag: read.anchorTag,
      patch,
      confirmationToken: preview.confirmationToken,
    })
    await vi.runAllTimersAsync()
    await expect(edit).rejects.toThrow("injected engine failure")

    expect(mindMap.getData()).toEqual(before)
    expect(session.getState().dirty).toBe(false)
  })

  it("commits and undoes a successful real mixed move and edit patch", async () => {
    vi.useFakeTimers()
    const { mindMap, portal } = createLivePortal()
    await vi.advanceTimersByTimeAsync(100)
    const before = mindMap.getData()
    const read = portal.read({ documentId: "patches", view: "subtree" })

    const edit = portal.edit({
      documentId: "patches",
      anchorTag: read.anchorTag,
      patch: "MOVE 3 -> 5:\nPUT 4.=4:\n+[P1] Updated & Ready",
    })
    await vi.runAllTimersAsync()
    await edit

    const current = mindMap.getData()
    expect(childTexts(current, "Module A")).toEqual(["Updated & Ready"])
    expect(childTexts(current, "Module B")).toEqual(["Case A & Ready"])
    expect(current.children[1]?.children[0]?.data.text).toBe("Case A & Ready")
    mindMap.execCommand("BACK")
    expect(mindMap.getData()).toEqual(before)
  })
  it("supports immediate query and sibling insertion after a compact-priority root replacement", async () => {
    const { mindMap, portal } = createLivePortal()
    const initial = portal.read({ documentId: "patches", view: "subtree" })
    const replacement = [
      "PUT 1.=5:",
      "+朋友圈",
      "+  # 朋友圈首页",
      "+    # 动态卡片",
      "+      # 点赞按钮",
      "+        [P1]点赞按钮-点赞动态 & 已登录且动态未点赞",
      "+          点击点赞按钮 & 点赞数增加 1",
    ].join("\n")
    const preview = await portal.edit({
      documentId: "patches",
      anchorTag: initial.anchorTag,
      patch: replacement,
      preview: true,
      confirmationToken: ":preview",
    })
    await portal.edit({
      documentId: "patches",
      anchorTag: initial.anchorTag,
      patch: replacement,
      confirmationToken: preview.confirmationToken,
    })

    const current = portal.read({ documentId: "patches", view: "outline" })
    expect(current.content).toContain("[P1] 点赞按钮-点赞动态")
    await portal.edit({
      documentId: "patches",
      anchorTag: current.anchorTag,
      patch: [
        "PUT >4:",
        "+      # 头像",
        "+        [P1]头像-进入用户主页 & 已登录",
        "+          点击头像 & 打开用户主页",
      ].join("\n"),
    })

    const root = mindMap.getData() as MindMapNodeTree
    const dynamicCard = root.children[0]?.children[0]
    expect(dynamicCard?.children.map(node => node.data.text)).toEqual(["点赞按钮", "头像"])
    expect(dynamicCard?.children[0]?.data.uid).toBeTruthy()
    expect(dynamicCard?.children[1]?.children[0]?.data.icon).toEqual(["priority_1"])
  })
  it("selects and centers the committed target once without focusing a preview", async () => {
    const { mindMap, portal } = createLivePortal({ includeStep: true })
    const center = vi.spyOn(mindMap.renderer, "moveNodeToCenter")
    const read = portal.read({ documentId: "patches", view: "subtree" })
    const patch = "PUT 3.=3:\n+[P2] Case A updated & Ready"

    const preview = await portal.edit({
      documentId: "patches",
      anchorTag: read.anchorTag,
      patch,
      preview: true,
    })
    expect(preview.phase).toBe("preview")
    expect(center).not.toHaveBeenCalled()
    await portal.edit({
      documentId: "patches",
      anchorTag: read.anchorTag,
      patch,
      confirmationToken: preview.confirmationToken,
    })
    expect(center).toHaveBeenCalledOnce()
    expect(center.mock.calls[0]?.[0]?.getData("uid")).toBe("case-a")
    expect(mindMap.renderer.activeNodeList.map(node => node.getData("uid"))).toEqual(["case-a"])
  })

  it("selects the new visible top-level node after replacing root content", async () => {
    const { mindMap, portal } = createLivePortal({ includeStep: true })
    const read = portal.read({ documentId: "patches", view: "subtree" })
    const patch = [
      "PUT 1.=6:",
      "+新根标题",
      "+  # 新顶层模块",
      "+    [P1] 新用例 & 已准备",
      "+      执行操作 & 得到结果",
    ].join("\n")
    const preview = await portal.edit({
      documentId: "patches",
      anchorTag: read.anchorTag,
      patch,
      preview: true,
    })
    await portal.edit({
      documentId: "patches",
      anchorTag: read.anchorTag,
      patch,
      confirmationToken: preview.confirmationToken,
    })

    expect(mindMap.renderer.activeNodeList.map(node => node.getData("text"))).toEqual([
      "新顶层模块",
    ])
  })

  it("selects every newly inserted sibling and centers only the first", async () => {
    const { mindMap, portal } = createLivePortal({ includeStep: true })
    const center = vi.spyOn(mindMap.renderer, "moveNodeToCenter")
    const read = portal.read({ documentId: "patches", view: "subtree" })
    await portal.edit({
      documentId: "patches",
      anchorTag: read.anchorTag,
      patch: [
        "PUT >3:",
        "+  [P2] 新用例一 & 已准备",
        "+    操作一 & 结果一",
        "+  [P3] 新用例二 & 已准备",
        "+    操作二 & 结果二",
      ].join("\n"),
    })

    expect(mindMap.renderer.activeNodeList.map(node => node.getData("text"))).toEqual([
      "新用例一 & 已准备",
      "新用例二 & 已准备",
    ])
    expect(center).toHaveBeenCalledOnce()
  })

  it("commits the representative 107-line comment feature patch with one render", async () => {
    const { mindMap, portal } = createLivePortal({ includeStep: true })
    const read = portal.read({ documentId: "patches", view: "subtree" })
    const patch = largeCommentFeaturePatch()
    expect(patch.split("\n")).toHaveLength(108)

    const previewStarted = performance.now()
    const preview = await portal.edit({
      documentId: "patches",
      anchorTag: read.anchorTag,
      patch,
      preview: true,
    })
    const previewMs = performance.now() - previewStarted
    expect(preview.phase).toBe("preview")
    expect(preview.confirmationToken).toEqual(expect.any(String))

    let renderCount = 0
    const onRenderStart = () => {
      renderCount += 1
    }
    mindMap.on("node_tree_render_start", onRenderStart)
    const commitStarted = performance.now()
    const result = await portal.edit({
      documentId: "patches",
      anchorTag: read.anchorTag,
      patch,
      confirmationToken: preview.confirmationToken,
      returnView: { view: "subtree", maxLines: 200 },
    })
    const commitAndRenderMs = performance.now() - commitStarted
    mindMap.off("node_tree_render_start", onRenderStart)

    expect(result.phase).toBe("committed")
    expect(result.view).toMatchObject({ lineCount: 107, truncated: false })
    expect(result.diagnostics).toEqual([])
    expect(renderCount).toBe(1)
    expect(commitAndRenderMs).toBeLessThan(5_000)
    console.info(
      JSON.stringify({
        benchmark: "portal-comment-feature-107-lines",
        previewMs: Number(previewMs.toFixed(2)),
        commitAndRenderMs: Number(commitAndRenderMs.toFixed(2)),
        renderCount,
        projectedLines: result.view?.lineCount,
        nodeCount: 107,
      })
    )
  })
  it("fills cases in a second turn without repeating layout per case", async () => {
    const { mindMap, portal } = createLivePortal({ includeStep: true })
    const initialRead = portal.read({ documentId: "patches", view: "subtree" })
    const outlinePatch = commentFeaturePatch({ rangeEnd: 6, includeSteps: false })
    const outlinePreview = await portal.edit({
      documentId: "patches",
      anchorTag: initialRead.anchorTag,
      patch: outlinePatch,
      preview: true,
    })
    const outline = await portal.edit({
      documentId: "patches",
      anchorTag: initialRead.anchorTag,
      patch: outlinePatch,
      confirmationToken: outlinePreview.confirmationToken,
      returnView: { view: "subtree", maxLines: 200 },
    })
    expect(outline.view).toMatchObject({ lineCount: 62, truncated: false })

    const fillPatch = commentFeaturePatch({ rangeEnd: 62, includeSteps: true })
    const previewStarted = performance.now()
    const fillPreview = await portal.edit({
      documentId: "patches",
      anchorTag: outline.view!.anchorTag,
      patch: fillPatch,
      preview: true,
    })
    const previewMs = performance.now() - previewStarted

    let renderCount = 0
    const onRenderStart = () => {
      renderCount += 1
    }
    mindMap.on("node_tree_render_start", onRenderStart)
    const commitStarted = performance.now()
    const filled = await portal.edit({
      documentId: "patches",
      anchorTag: outline.view!.anchorTag,
      patch: fillPatch,
      confirmationToken: fillPreview.confirmationToken,
      returnView: { view: "subtree", maxLines: 200 },
    })
    const commitAndRenderMs = performance.now() - commitStarted
    mindMap.off("node_tree_render_start", onRenderStart)

    expect(filled.phase).toBe("committed")
    expect(filled.view).toMatchObject({ lineCount: 107, truncated: false })
    expect(filled.diagnostics).toEqual([])
    expect(renderCount).toBe(1)
    expect(previewMs).toBeLessThan(1_000)
    expect(commitAndRenderMs).toBeLessThan(5_000)
    console.info(
      JSON.stringify({
        benchmark: "portal-comment-feature-two-turn-fill",
        outlineLines: outline.view?.lineCount,
        filledLines: filled.view?.lineCount,
        previewMs: Number(previewMs.toFixed(2)),
        commitAndRenderMs: Number(commitAndRenderMs.toFixed(2)),
        renderCount,
      })
    )
  })
})
