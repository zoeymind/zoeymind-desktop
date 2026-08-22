// @vitest-environment jsdom
//
// 回归：Windows WebView2 (Chromium) 对 display:none 的 SVG 元素
// getBoundingClientRect() 返回全 0。TextEdit.show() 先测量再 g.hide()，
// glyph 对齐必须使用隐藏前的 rect，绝不能重新查询已隐藏的 tspan——
// 否则 delta = 首字符完整屏幕 Y，编辑框被 translateY 推到窗口顶部。

import MindMap, { type MindMapNodeTree } from "simple-mind-map"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"

const maps: MindMap[] = []

// 模拟 Chromium 语义的可切换 SVG rect：元素或祖先带 display:none 时返回全 0。
const VISIBLE_SVG_RECT = {
  x: 200,
  y: 300,
  top: 300,
  left: 200,
  right: 280,
  bottom: 320,
  width: 80,
  height: 20,
  toJSON: () => ({}),
}
const ZERO_RECT = {
  x: 0,
  y: 0,
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  width: 0,
  height: 0,
  toJSON: () => ({}),
}

function isDisplayNone(el: Element): boolean {
  for (let cur: Element | null = el; cur; cur = cur.parentElement) {
    if (cur instanceof HTMLElement || cur instanceof SVGElement) {
      if (cur.style && cur.style.display === "none") return true
    }
  }
  return false
}

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
  Object.defineProperty(SVGElement.prototype, "getBoundingClientRect", {
    configurable: true,
    value: function (this: SVGElement) {
      return isDisplayNone(this) ? ZERO_RECT : VISIBLE_SVG_RECT
    },
  })
  // wrapTextByDom / glyph 对齐都会创建 Range；jsdom Range 无布局，给稳定值。
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
  vi.restoreAllMocks()
  for (const map of maps.splice(0)) map.destroy()
  document.body.replaceChildren()
})

describe("node text editor positioning", () => {
  it("never derives the glyph delta from the hidden SVG text (Windows top-drift regression)", async () => {
    const element = document.createElement("div")
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
    document.body.append(element)
    const data: MindMapNodeTree = {
      data: { uid: "root", text: "Root" },
      children: [{ data: { uid: "case-a", text: "Windows text" }, children: [] }],
    }
    const mindMap = new MindMap({ el: element, width: 1_000, height: 800, data })
    maps.push(mindMap)

    let node = mindMap.renderer.findNodeByUid("case-a")
    await vi.waitFor(() => {
      node = mindMap.renderer.findNodeByUid("case-a")
      expect(node).toBeDefined()
    })
    await mindMap.renderer.textEdit.show({ node: node! })

    const editor = document.querySelector<HTMLElement>(".smm-node-edit-wrap")
    expect(editor).not.toBeNull()
    // 编辑框锚定隐藏前测得的 SVG rect（top: 300）。
    expect(editor!.style.top).toBe("300px")
    // glyph 对齐 delta = domFirstCharTop(0) − rect.top(300) = −300 → translateY(300px)。
    // 若实现回退到查询已隐藏的 tspan（rect 全 0），delta 变成 0−0，或在真实浏览器
    // 中变成 +首字符屏幕Y——通过断言 transform 精确值锁住正确的数据来源。
    expect(editor!.style.transform).toBe("translateY(300px)")
  })
})
