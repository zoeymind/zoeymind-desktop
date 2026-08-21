import type MindMap from "simple-mind-map"
import { describe, expect, it, vi } from "vitest"
import {
  PROJECT_SESSION_LIFECYCLE,
  createProjectSessionRegistry,
  createProjectSessionStore,
} from "@/products/mind/editor-session"
import type { OpenTab } from "@/shared/tabs/store"
import { createMindMapDocumentPortal } from "./mindmap-document-portal"

function createMindMap(data: unknown): MindMap {
  return {
    getData: vi.fn(() => data),
    on: vi.fn(),
  } as unknown as MindMap
}

function createPortalFixture(options: { tabs: OpenTab[]; activeId?: string | "home" }) {
  const registry = createProjectSessionRegistry()
  const portal = createMindMapDocumentPortal({
    registry,
    getTabs: () => ({ tabs: options.tabs, activeId: options.activeId ?? "home" }),
  })
  return { portal, registry }
}

describe("DocumentPortal", () => {
  it("lists every open tab and reports live session readiness without changing document identity", () => {
    const tabs: OpenTab[] = [
      {
        id: "unsaved-checkout",
        kind: "file",
        title: "结算测试",
        projectId: "persisted-checkout",
      },
      { id: "orders", kind: "file", title: "订单测试", projectId: "orders" },
    ]
    const { portal, registry } = createPortalFixture({ tabs, activeId: "orders" })
    const checkout = createProjectSessionStore("unsaved-checkout", { dirty: true })
    checkout.getState().setLifecycle(PROJECT_SESSION_LIFECYCLE.READY)
    checkout.getState().setMindMap(createMindMap({ data: { text: "结算" }, children: [] }))
    registry.register(checkout)

    expect(portal.listDocuments()).toEqual([
      {
        documentId: "unsaved-checkout",
        title: "结算测试",
        active: false,
        ready: true,
        dirty: true,
        revision: 0,
      },
      {
        documentId: "orders",
        title: "订单测试",
        active: true,
        ready: false,
        dirty: false,
        revision: 0,
      },
    ])
  })

  it("advances only the changed live document revision", () => {
    const tabs: OpenTab[] = [
      { id: "payments", kind: "file", title: "支付测试", projectId: "payments" },
    ]
    const { portal, registry } = createPortalFixture({ tabs })
    const mindMap = createMindMap({ data: { text: "支付测试" }, children: [] })
    const payments = createProjectSessionStore("payments")
    payments.getState().setLifecycle(PROJECT_SESSION_LIFECYCLE.READY)
    payments.getState().setMindMap(mindMap)
    registry.register(payments)

    expect(portal.listDocuments()[0]?.revision).toBe(0)
    const dataChangeListener = vi
      .mocked(mindMap.on)
      .mock.calls.find(([event]) => event === "data_change")?.[1]
    expect(dataChangeListener).toBeTypeOf("function")
    dataChangeListener?.()
    expect(portal.listDocuments()[0]?.revision).toBe(1)
  })

  it("reads an explicitly selected subtree as bounded Test Document text without exposing UIDs", () => {
    const tabs: OpenTab[] = [
      { id: "payments", kind: "file", title: "支付测试", projectId: "payments" },
      { id: "orders", kind: "file", title: "订单测试", projectId: "orders" },
    ]
    const { portal, registry } = createPortalFixture({ tabs, activeId: "orders" })
    const payments = createProjectSessionStore("payments")
    payments.getState().setLifecycle(PROJECT_SESSION_LIFECYCLE.READY)
    payments.getState().setMindMap(
      createMindMap({
        data: { uid: "root-secret", text: "电商测试" },
        children: [
          {
            data: { uid: "module-secret", text: "支付", icon: ["sign_2"] },
            children: [
              {
                data: {
                  uid: "case-secret",
                  text: "用户申请退款 & 订单已支付",
                  icon: ["priority_1"],
                },
                children: [
                  {
                    data: { uid: "step-secret", text: "点击申请退款 & 显示退款确认弹窗" },
                    children: [],
                  },
                ],
              },
            ],
          },
        ],
      })
    )
    registry.register(payments)

    const result = portal.read({
      documentId: "payments",
      view: "subtree",
      path: ["支付"],
      maxLines: 20,
    })

    expect(result).toEqual({
      documentId: "payments",
      title: "支付测试",
      view: "subtree",
      path: ["支付"],
      revision: 0,
      content: [
        "1: # 支付",
        "2:   [P1] 用户申请退款 & 订单已支付",
        "3:     点击申请退款 & 显示退款确认弹窗",
      ].join("\n"),
      lineCount: 3,
      truncated: false,
    })
    expect(result.content).not.toContain("secret")
  })

  it("bounds default outline reads instead of returning the complete document", () => {
    const tabs: OpenTab[] = [{ id: "large", kind: "file", title: "大型测试", projectId: "large" }]
    const { portal, registry } = createPortalFixture({ tabs })
    const session = createProjectSessionStore("large")
    session.getState().setLifecycle(PROJECT_SESSION_LIFECYCLE.READY)
    session.getState().setMindMap(
      createMindMap({
        data: { text: "大型测试" },
        children: Array.from({ length: 250 }, (_, index) => ({
          data: { uid: `module-${index}`, text: `模块 ${index}`, icon: ["sign_2"] },
          children: [],
        })),
      })
    )
    registry.register(session)

    const result = portal.read({ documentId: "large", view: "outline" })

    expect(result.lineCount).toBe(200)
    expect(result.truncated).toBe(true)
    expect(result.content).toContain("1: # 大型测试")
    expect(result.content).not.toContain("module-0")
  })

  it("stops projecting after the truncation boundary", () => {
    const tabs: OpenTab[] = [
      { id: "guarded", kind: "file", title: "Guarded", projectId: "guarded" },
    ]
    const { portal, registry } = createPortalFixture({ tabs })
    const unreadNode = {
      get data(): never {
        throw new Error("projection traversed beyond maxLines + 1")
      },
      children: [],
    }
    const session = createProjectSessionStore("guarded")
    session.getState().setLifecycle(PROJECT_SESSION_LIFECYCLE.READY)
    session.getState().setMindMap(
      createMindMap({
        data: { text: "Guarded" },
        children: [
          { data: { text: "模块 1", icon: ["sign_2"] }, children: [] },
          { data: { text: "模块 2", icon: ["sign_2"] }, children: [] },
          unreadNode,
        ],
      })
    )
    registry.register(session)

    expect(portal.read({ documentId: "guarded", view: "outline", maxLines: 1 })).toMatchObject({
      lineCount: 1,
      truncated: true,
    })
  })

  it("rejects missing and unready documents without falling back to the active session", () => {
    const tabs: OpenTab[] = [
      { id: "ready", kind: "file", title: "Ready", projectId: "ready" },
      { id: "loading", kind: "file", title: "Loading", projectId: "loading" },
    ]
    const { portal, registry } = createPortalFixture({ tabs, activeId: "ready" })
    const ready = createProjectSessionStore("ready")
    ready.getState().setLifecycle(PROJECT_SESSION_LIFECYCLE.READY)
    ready.getState().setMindMap(createMindMap({ data: { text: "Ready" }, children: [] }))
    registry.register(ready)

    expect(() => portal.read({ documentId: "loading", view: "outline" })).toThrow(
      "Document is not ready: loading"
    )
    expect(() => portal.read({ documentId: "closed", view: "outline" })).toThrow(
      "Document is not open: closed"
    )
  })
})
