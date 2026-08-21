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

function createLivePortal() {
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
            children: [],
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
    let portalCommandCount = 0
    vi.spyOn(mindMap, "execCommand").mockImplementation((command, ...args) => {
      if (command === "MOVE_NODE_TO" || command === "SET_NODE_TEXT") {
        portalCommandCount += 1
        if (portalCommandCount === 2) throw new Error("injected engine failure")
      }
      execute(command, ...args)
    })

    await expect(
      portal.edit({
        documentId: "patches",
        anchorTag: read.anchorTag,
        patch: "MOVE 3 -> 5:\nPUT 4.=4:\n+[P1] Updated & Ready",
      })
    ).rejects.toThrow("injected engine failure")

    expect(mindMap.getData()).toEqual(before)
    expect(session.getState().dirty).toBe(false)
  })

  it("applies and undoes an inserted real subtree with stable domain data", async () => {
    vi.useFakeTimers()
    const { mindMap, portal } = createLivePortal()
    await vi.advanceTimersByTimeAsync(100)
    const before = mindMap.getData()
    const read = portal.read({ documentId: "patches", view: "subtree", path: ["Module A"] })

    await portal.edit({
      documentId: "patches",
      anchorTag: read.anchorTag,
      patch: "PUT >3:\n+[P2] Added & Ready\n+  Run action & Observe result",
    })

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
    let commandCount = 0
    vi.spyOn(mindMap, "execCommand").mockImplementation((command, ...args) => {
      if (command !== "CLEAR_ACTIVE_NODE") commandCount += 1
      if (commandCount === 3) throw new Error("injected engine failure")
      execute(command, ...args)
    })

    await expect(
      portal.edit({
        documentId: "patches",
        anchorTag: read.anchorTag,
        patch,
        confirmationToken: preview.preview?.confirmationToken,
      })
    ).rejects.toMatchObject({ code: "DOCUMENT_CONSISTENCY_ERROR" })

    expect(mindMap.getData()).toEqual(before)
    expect(session.getState().dirty).toBe(false)
  })

  it("commits and undoes a successful real mixed move and edit patch", async () => {
    vi.useFakeTimers()
    const { mindMap, portal } = createLivePortal()
    await vi.advanceTimersByTimeAsync(100)
    const before = mindMap.getData()
    const read = portal.read({ documentId: "patches", view: "subtree" })

    await portal.edit({
      documentId: "patches",
      anchorTag: read.anchorTag,
      patch: "MOVE 3 -> 5:\nPUT 4.=4:\n+[P1] Updated & Ready",
    })
    await vi.runAllTimersAsync()

    const current = mindMap.getData()
    expect(childTexts(current, "Module A")).toEqual(["Updated & Ready"])
    expect(childTexts(current, "Module B")).toEqual(["Case A & Ready"])
    expect(current.children[1]?.children[0]?.data.text).toBe("Case A & Ready")
    mindMap.execCommand("BACK")
    expect(mindMap.getData()).toEqual(before)
  })
})
