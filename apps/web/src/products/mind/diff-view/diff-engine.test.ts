import { describe, expect, it } from "vitest"
import type { MindMapNodeTree } from "simple-mind-map"
import { computeDiff, diffCount, isDiffEmpty, snapshotTree } from "./diff-engine"

/** 造节点便利函数 */
function node(uid: string, text: string, children: MindMapNodeTree[] = []): MindMapNodeTree {
  return { data: { uid, text }, children }
}

describe("computeDiff", () => {
  it("baseline 与 current 完全一致时 diff 为空", () => {
    const tree = node("root", "R", [node("a", "A"), node("b", "B")])
    const baseline = snapshotTree(tree)
    const state = computeDiff(tree, baseline)
    expect(isDiffEmpty(state)).toBe(true)
    expect(diffCount(state)).toBe(0)
  })

  it("新增节点计入 addedUids", () => {
    const base = node("root", "R", [node("a", "A")])
    const current = node("root", "R", [node("a", "A"), node("b", "B")])
    const state = computeDiff(current, snapshotTree(base))
    expect([...state.addedUids]).toEqual(["b"])
    expect(state.modifiedUids.size).toBe(0)
    expect(state.removedUids.size).toBe(0)
    expect(state.movedUids.size).toBe(0)
  })

  it("删除节点计入 removedUids", () => {
    const base = node("root", "R", [node("a", "A"), node("b", "B")])
    const current = node("root", "R", [node("a", "A")])
    const state = computeDiff(current, snapshotTree(base))
    expect([...state.removedUids]).toEqual(["b"])
  })

  it("文本修改计入 modifiedUids", () => {
    const base = node("root", "R", [node("a", "old")])
    const current = node("root", "R", [node("a", "new")])
    const state = computeDiff(current, snapshotTree(base))
    expect([...state.modifiedUids]).toEqual(["a"])
    expect(state.addedUids.size).toBe(0)
  })

  it("图标修改计入 modifiedUids", () => {
    const base: MindMapNodeTree = {
      data: { uid: "a", text: "T", icon: ["priority_1"] },
      children: [],
    }
    const current: MindMapNodeTree = {
      data: { uid: "a", text: "T", icon: ["priority_2"] },
      children: [],
    }
    const state = computeDiff(current, snapshotTree(base))
    expect([...state.modifiedUids]).toEqual(["a"])
  })

  it("父节点变化计入 movedUids", () => {
    const base = node("root", "R", [node("a", "A", [node("c", "C")]), node("b", "B")])
    const current = node("root", "R", [node("a", "A"), node("b", "B", [node("c", "C")])])
    const state = computeDiff(current, snapshotTree(base))
    expect([...state.movedUids]).toEqual(["c"])
    expect(state.modifiedUids.size).toBe(0)
  })

  it("同级顺序变化不算 move", () => {
    const base = node("root", "R", [node("a", "A"), node("b", "B")])
    const current = node("root", "R", [node("b", "B"), node("a", "A")])
    const state = computeDiff(current, snapshotTree(base))
    expect(isDiffEmpty(state)).toBe(true)
  })

  it("同时改文案 + 换父可以同时命中 modify 和 move", () => {
    const base = node("root", "R", [node("a", "A", [node("c", "old")]), node("b", "B")])
    const current = node("root", "R", [node("a", "A"), node("b", "B", [node("c", "new")])])
    const state = computeDiff(current, snapshotTree(base))
    expect([...state.movedUids]).toEqual(["c"])
    expect([...state.modifiedUids]).toEqual(["c"])
  })

  it("没有 uid 的节点被跳过, 不会当作删除或新增", () => {
    const base: MindMapNodeTree = { data: { text: "root" }, children: [] }
    const current: MindMapNodeTree = { data: { text: "root" }, children: [] }
    const state = computeDiff(current, snapshotTree(base))
    expect(isDiffEmpty(state)).toBe(true)
  })
})
