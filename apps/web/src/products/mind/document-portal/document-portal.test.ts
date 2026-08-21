import type MindMap from "simple-mind-map"
import { describe, expect, it, vi } from "vitest"
import {
  PROJECT_SESSION_LIFECYCLE,
  createProjectSessionRegistry,
  createProjectSessionStore,
} from "@/products/mind/editor-session"
import type { OpenTab } from "@/shared/tabs/store"
import { createMindMapDocumentPortal } from "./mindmap-document-portal"
import { parseTreeHashlinePatch } from "./patch/tree-hashline-patch"

type EditableMindMap = MindMap & {
  renderer: MindMap["renderer"]
  execCommand: MindMap["execCommand"]
  command: MindMap["command"]
}

type RuntimeNode = {
  data: { uid: string; text: string; icon?: string[] }
  children: RuntimeNode[]
}

function createMindMap(data: unknown): MindMap {
  return {
    getData: vi.fn(() => data),
    on: vi.fn(),
  } as unknown as MindMap
}

function createStatefulMindMap(root: RuntimeNode, throwOnCommand?: number) {
  let sequence = 0
  let commandCount = 0
  const find = (node: typeof root, uid: string): typeof root | null =>
    node.data.uid === uid
      ? node
      : node.children.reduce<typeof root | null>(
          (found, child) => found ?? find(child as typeof root, uid),
          null
        )
  const parentOf = (node: typeof root, uid: string): typeof root | null =>
    node.children.some(child => child.data.uid === uid)
      ? node
      : node.children.reduce<typeof root | null>(
          (found, child) => found ?? parentOf(child as typeof root, uid),
          null
        )
  const live = (node: typeof root) => ({
    getData: (key: string) => node.data[key as keyof typeof node.data],
  })
  const mindMap = createMindMap(root) as EditableMindMap
  Object.defineProperties(mindMap, {
    renderer: {
      value: {
        findNodeByUid: vi.fn((uid: string) => {
          const node = find(root, uid)
          return node ? live(node) : null
        }),
      },
    },
    command: { value: { pause: vi.fn(), recovery: vi.fn(), addHistory: vi.fn() } },
    execCommand: {
      value: vi.fn((command: string, ...args: unknown[]) => {
        commandCount += 1
        if (throwOnCommand === commandCount) throw new Error("engine failure")
        if (command === "SET_NODE_TEXT") {
          const node = find(
            root,
            String((args[0] as { getData: (key: string) => string }).getData("uid"))
          )
          if (node) node.data.text = String(args[1])
        }
        if (command === "INSERT_MULTI_CHILD_NODE") {
          const parent = find(
            root,
            String((args[0] as Array<{ getData: (key: string) => string }>)[0]!.getData("uid"))
          )
          if (parent)
            parent.children.push(
              ...(args[1] as typeof root.children).map(node => ({
                ...node,
                data: { ...node.data, uid: node.data.uid ?? `new-${sequence++}` },
              }))
            )
        }
        if (command === "INSERT_MULTI_NODE") {
          const sibling = find(
            root,
            String((args[0] as Array<{ getData: (key: string) => string }>)[0]!.getData("uid"))
          )
          const parent = sibling ? parentOf(root, sibling.data.uid) : null
          if (parent && sibling)
            parent.children.splice(
              parent.children.indexOf(sibling),
              0,
              ...(args[1] as typeof root.children).map(node => ({
                ...node,
                data: { ...node.data, uid: node.data.uid ?? `new-${sequence++}` },
              }))
            )
        }
        if (command === "REMOVE_NODE")
          for (const item of args[0] as Array<{ getData: (key: string) => string }>) {
            const parent = parentOf(root, item.getData("uid"))
            if (parent)
              parent.children = parent.children.filter(
                node => node.data.uid !== item.getData("uid")
              )
          }
        if (command === "MOVE_NODE_TO") {
          const node = find(
            root,
            String((args[0] as Array<{ getData: (key: string) => string }>)[0]!.getData("uid"))
          )
          const oldParent = node ? parentOf(root, node.data.uid) : null
          const newParent = node
            ? find(root, String((args[1] as { getData: (key: string) => string }).getData("uid")))
            : null
          if (node && oldParent && newParent) {
            oldParent.children = oldParent.children.filter(child => child !== node)
            newParent.children.push(node)
          }
        }
      }),
    },
  })
  return { mindMap, root }
}

function registerLivePortal(
  root: Parameters<typeof createStatefulMindMap>[0],
  throwOnCommand?: number
) {
  const tabs: OpenTab[] = [{ id: "patches", kind: "file", title: "补丁", projectId: "patches" }]
  const { portal, registry } = createPortalFixture({ tabs })
  const fixture = createStatefulMindMap(root, throwOnCommand)
  const session = createProjectSessionStore("patches")
  session.getState().setLifecycle(PROJECT_SESSION_LIFECYCLE.READY)
  session.getState().setMindMap(fixture.mindMap)
  registry.register(session)
  return { portal, session, ...fixture }
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

    expect(result).toMatchObject({
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
    expect(result.anchorTag).toEqual(expect.any(String))
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

  it("searches live structured fields without UIDs and returns public subtree read paths", () => {
    const tabs: OpenTab[] = [
      { id: "payments", kind: "file", title: "支付测试", projectId: "payments" },
    ]
    const { portal, registry } = createPortalFixture({ tabs })
    const session = createProjectSessionStore("payments")
    session.getState().setLifecycle(PROJECT_SESSION_LIFECYCLE.READY)
    session.getState().setMindMap(
      createMindMap({
        data: { text: "电商测试" },
        children: [
          {
            data: { uid: "module-secret", text: "关键模块", icon: ["sign_2"] },
            children: [
              {
                data: { uid: "case-secret", text: "关键用例 & 关键前置", icon: ["priority_1"] },
                children: [
                  {
                    data: { uid: "step-secret", text: "关键操作 & 关键预期" },
                    children: [],
                  },
                ],
              },
            ],
          },
        ],
      })
    )
    registry.register(session)

    const result = portal.search({ documentId: "payments", query: "关键" })

    expect(result).toEqual({
      documentId: "payments",
      revision: 0,
      total: 5,
      returned: 5,
      truncated: false,
      hits: [
        { modulePath: ["关键模块"], readPath: ["关键模块"], field: "module" },
        {
          modulePath: ["关键模块"],
          readPath: ["关键模块", "关键用例 & 关键前置"],
          field: "caseTitle",
        },
        {
          modulePath: ["关键模块"],
          readPath: ["关键模块", "关键用例 & 关键前置"],
          field: "precondition",
        },
        {
          modulePath: ["关键模块"],
          readPath: ["关键模块", "关键用例 & 关键前置", "关键操作 & 关键预期"],
          field: "operation",
        },
        {
          modulePath: ["关键模块"],
          readPath: ["关键模块", "关键用例 & 关键前置", "关键操作 & 关键预期"],
          field: "expected",
        },
      ],
    })
    expect(result.hits.some(hit => JSON.stringify(hit).includes("secret"))).toBe(false)
    expect(
      portal.read({
        documentId: "payments",
        view: "subtree",
        path: result.hits[3]?.readPath,
      }).content
    ).toContain("关键操作 & 关键预期")
  })

  it("scopes field search and pages the stable live traversal without overlap", () => {
    const tabs: OpenTab[] = [{ id: "orders", kind: "file", title: "订单测试", projectId: "orders" }]
    const { portal, registry } = createPortalFixture({ tabs })
    const session = createProjectSessionStore("orders")
    session.getState().setLifecycle(PROJECT_SESSION_LIFECYCLE.READY)
    session.getState().setMindMap(
      createMindMap({
        data: { text: "电商测试" },
        children: [
          {
            data: { text: "订单", icon: ["sign_2"] },
            children: [
              { data: { text: "退款", icon: ["sign_2"] }, children: [] },
              { data: { text: "退款记录", icon: ["sign_2"] }, children: [] },
            ],
          },
          { data: { text: "退款归档", icon: ["sign_2"] }, children: [] },
        ],
      })
    )
    registry.register(session)

    const first = portal.search({
      documentId: "orders",
      query: "退款",
      fields: ["module"],
      scope: ["订单"],
      limit: 1,
    })
    const second = portal.search({
      documentId: "orders",
      query: "退款",
      fields: ["module"],
      scope: ["订单"],
      limit: 1,
      cursor: first.nextCursor,
    })

    expect(first).toMatchObject({
      total: 2,
      returned: 1,
      truncated: true,
      nextCursor: "1",
      hits: [{ modulePath: ["订单", "退款"], readPath: ["订单", "退款"], field: "module" }],
    })
    expect(second).toMatchObject({
      total: 2,
      returned: 1,
      truncated: false,
      hits: [{ modulePath: ["订单", "退款记录"], readPath: ["订单", "退款记录"], field: "module" }],
    })
    expect(second.nextCursor).toBeUndefined()
  })

  it("edits a fresh anchored line through one live command, marks the session dirty, and keeps UIDs private", async () => {
    const tabs: OpenTab[] = [
      { id: "payments", kind: "file", title: "支付测试", projectId: "payments" },
    ]
    const { portal, registry } = createPortalFixture({ tabs })
    const node = { uid: "private-node", getData: vi.fn(() => "支付用例") }
    const mindMap = createMindMap({
      data: { text: "电商测试" },
      children: [{ data: { uid: "private-node", text: "支付用例" }, children: [] }],
    }) as EditableMindMap
    Object.defineProperties(mindMap, {
      renderer: { value: { findNodeByUid: vi.fn(() => node) } },
      command: { value: { pause: vi.fn(), recovery: vi.fn(), addHistory: vi.fn() } },
      execCommand: { value: vi.fn() },
    })
    const session = createProjectSessionStore("payments")
    session.getState().setLifecycle(PROJECT_SESSION_LIFECYCLE.READY)
    session.getState().setMindMap(mindMap)
    registry.register(session)

    const read = portal.read({ documentId: "payments", view: "subtree" })
    expect(JSON.stringify(read)).not.toContain("private-node")

    await expect(
      portal.edit({
        documentId: "payments",
        anchorTag: read.anchorTag,
        patch: "PUT 2.=2:\n+已支付用例",
      })
    ).resolves.toMatchObject({ documentId: "payments", dirty: true })
    expect(mindMap.execCommand).toHaveBeenCalledWith("SET_NODE_TEXT", node, "已支付用例")
    expect(mindMap.command.pause).toHaveBeenCalledOnce()
    expect(mindMap.command.recovery).toHaveBeenCalledOnce()
    expect(mindMap.command.addHistory).toHaveBeenCalledOnce()
    expect(session.getState().dirty).toBe(true)
  })

  it("rejects stale or expired line anchors without issuing a command", async () => {
    const tabs: OpenTab[] = [
      { id: "payments", kind: "file", title: "支付测试", projectId: "payments" },
    ]
    const { portal, registry } = createPortalFixture({ tabs })
    const mindMap = createMindMap({
      data: { text: "电商测试" },
      children: [{ data: { uid: "private-node", text: "支付用例" }, children: [] }],
    }) as MindMap & { execCommand: (command: string, ...args: unknown[]) => void }
    mindMap.execCommand = vi.fn()
    const session = createProjectSessionStore("payments")
    session.getState().setLifecycle(PROJECT_SESSION_LIFECYCLE.READY)
    session.getState().setMindMap(mindMap)
    registry.register(session)
    const read = portal.read({ documentId: "payments", view: "subtree" })
    vi.mocked(mindMap.getData).mockReturnValue({
      root: {
        data: { text: "电商测试" },
        children: [{ data: { uid: "private-node", text: "已由他人修改" }, children: [] }],
      },
      layout: "mindMap",
      theme: { template: "classic", config: {} },
      view: { scale: 1, translateX: 0, translateY: 0 },
    })

    await expect(
      portal.edit({
        documentId: "payments",
        anchorTag: read.anchorTag,
        patch: "PUT 2.=2:\n+新文本",
      })
    ).rejects.toMatchObject({ code: "DOCUMENT_EDIT_CONFLICT" })
    expect(mindMap.execCommand).not.toHaveBeenCalled()
  })
  it("applies case insertion and full subtree replacement through the live engine", async () => {
    const { portal, root } = registerLivePortal({
      data: { uid: "root", text: "文档" },
      children: [
        {
          data: { uid: "module", text: "模块", icon: ["sign_2"] },
          children: [{ data: { uid: "case", text: "旧用例", icon: ["priority_1"] }, children: [] }],
        },
      ],
    })
    const read = portal.read({ documentId: "patches", view: "subtree" })
    const patch = "PUT 3.=3:\n+[P1] 新用例\n+  前置\n+  操作"
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
      confirmationToken: preview.preview?.confirmationToken,
    })
    expect(root.children[0]?.children[0]?.data.text).toBe("新用例")
    expect(root.children[0]?.children[0]?.children.map(node => node.data.text)).toEqual([
      "前置",
      "操作",
    ])
  })

  it("requires a matching preview confirmation before applying the complete deletion cascade", async () => {
    const { portal, root } = registerLivePortal({
      data: { uid: "root", text: "文档" },
      children: [
        {
          data: { uid: "module", text: "模块", icon: ["sign_2"] },
          children: [
            {
              data: { uid: "case", text: "用例", icon: ["priority_1"] },
              children: [{ data: { uid: "step", text: "步骤" }, children: [] }],
            },
          ],
        },
      ],
    })
    const read = portal.read({ documentId: "patches", view: "subtree" })
    const preview = await portal.edit({
      documentId: "patches",
      anchorTag: read.anchorTag,
      patch: "CUT 3:",
      preview: true,
    })
    expect(preview.preview).toMatchObject({
      destructive: true,
      removedNodes: 2,
      affectedNodes: [
        { path: ["模块", "用例"], type: "case", text: "用例", depth: 0, count: 2 },
        { path: ["模块", "用例", "步骤"], type: "step", text: "步骤", depth: 1, count: 1 },
      ],
    })
    expect(preview.preview?.confirmationToken).toEqual(expect.any(String))
    await expect(
      portal.edit({ documentId: "patches", anchorTag: read.anchorTag, patch: "CUT 3:" })
    ).rejects.toMatchObject({ code: "DOCUMENT_PREVIEW_REQUIRED" })
    expect(root.children[0]?.children).toHaveLength(1)
    await portal.edit({
      documentId: "patches",
      anchorTag: read.anchorTag,
      patch: "CUT 3:",
      confirmationToken: preview.preview?.confirmationToken,
    })
    expect(root.children[0]?.children).toEqual([])
  })

  it("rejects stale destructive confirmations before mutating the live document", async () => {
    const { portal, root } = registerLivePortal({
      data: { uid: "root", text: "文档" },
      children: [
        {
          data: { uid: "module", text: "模块", icon: ["sign_2"] },
          children: [
            {
              data: { uid: "case", text: "用例", icon: ["priority_1"] },
              children: [{ data: { uid: "step", text: "步骤" }, children: [] }],
            },
          ],
        },
      ],
    })
    const read = portal.read({ documentId: "patches", view: "subtree" })
    const preview = await portal.edit({
      documentId: "patches",
      anchorTag: read.anchorTag,
      patch: "CUT 3:",
      preview: true,
    })
    root.children[0]?.children[0]?.children.push({
      data: { uid: "new-step", text: "新步骤" },
      children: [],
    })
    await expect(
      portal.edit({
        documentId: "patches",
        anchorTag: read.anchorTag,
        patch: "CUT 3:",
        confirmationToken: preview.preview?.confirmationToken,
      })
    ).rejects.toMatchObject({ code: "DOCUMENT_EDIT_CONFLICT" })
    expect(root.children[0]?.children).toHaveLength(1)
  })

  it("rejects inclusive PUT and CUT ranges before issuing live commands", async () => {
    const { portal, mindMap } = registerLivePortal({
      data: { uid: "root", text: "文档" },
      children: [
        {
          data: { uid: "module", text: "模块", icon: ["sign_2"] },
          children: [
            { data: { uid: "case-a", text: "用例A", icon: ["priority_1"] }, children: [] },
            { data: { uid: "case-b", text: "用例B", icon: ["priority_1"] }, children: [] },
          ],
        },
      ],
    })
    const read = portal.read({ documentId: "patches", view: "subtree" })

    await expect(
      portal.edit({
        documentId: "patches",
        anchorTag: read.anchorTag,
        patch: "PUT 3.=4:\n+[P1] 新用例",
      })
    ).rejects.toMatchObject({ code: "INVALID_DOCUMENT_EDIT_PATCH" })
    await expect(
      portal.edit({ documentId: "patches", anchorTag: read.anchorTag, patch: "CUT 3.=4:" })
    ).rejects.toMatchObject({ code: "INVALID_DOCUMENT_EDIT_PATCH" })
    expect(mindMap.execCommand).not.toHaveBeenCalled()
  })

  it("rolls back each inserted operation without removing prior batch inserts twice", async () => {
    const initial = {
      data: { uid: "root", text: "文档" },
      children: [
        {
          data: { uid: "module", text: "模块", icon: ["sign_2"] },
          children: [{ data: { uid: "case", text: "用例", icon: ["priority_1"] }, children: [] }],
        },
      ],
    }
    const { portal, root, mindMap } = registerLivePortal(structuredClone(initial), 3)
    const read = portal.read({ documentId: "patches", view: "subtree" })

    await expect(
      portal.edit({
        documentId: "patches",
        anchorTag: read.anchorTag,
        patch: "PUT >3:\n+[P1] 用例A\nPUT >3:\n+[P1] 用例B\nPUT >3:\n+[P1] 用例C",
      })
    ).rejects.toThrow("engine failure")
    expect(root).toEqual(initial)
    expect(
      vi.mocked(mindMap.execCommand).mock.calls.filter(([command]) => command === "REMOVE_NODE")
    ).toHaveLength(2)
  })

  it("replaces a middle sibling at its original index", async () => {
    const { portal, root } = registerLivePortal({
      data: { uid: "root", text: "文档" },
      children: [
        {
          data: { uid: "module", text: "模块", icon: ["sign_2"] },
          children: [
            { data: { uid: "case-a", text: "用例A", icon: ["priority_1"] }, children: [] },
            { data: { uid: "case-b", text: "用例B", icon: ["priority_1"] }, children: [] },
            { data: { uid: "case-c", text: "用例C", icon: ["priority_1"] }, children: [] },
          ],
        },
      ],
    })
    const read = portal.read({ documentId: "patches", view: "subtree" })
    const preview = await portal.edit({
      documentId: "patches",
      anchorTag: read.anchorTag,
      patch: "PUT 4.=4:\n+[P1] 新用例",
      preview: true,
    })

    await portal.edit({
      documentId: "patches",
      anchorTag: read.anchorTag,
      patch: "PUT 4.=4:\n+[P1] 新用例",
      confirmationToken: preview.preview?.confirmationToken,
    })
    expect(root.children[0]?.children.map(node => node.data.text)).toEqual([
      "用例A",
      "新用例",
      "用例C",
    ])
  })

  it("inserts after a middle sibling and accepts subtree anchors", async () => {
    const { portal, root } = registerLivePortal({
      data: { uid: "root", text: "文档" },
      children: [
        {
          data: { uid: "module", text: "模块", icon: ["sign_2"] },
          children: [
            {
              data: { uid: "case-a", text: "用例A", icon: ["priority_1"] },
              children: [{ data: { uid: "step-a", text: "步骤A" }, children: [] }],
            },
            { data: { uid: "case-b", text: "用例B", icon: ["priority_1"] }, children: [] },
          ],
        },
      ],
    })
    const read = portal.read({ documentId: "patches", view: "subtree" })

    await portal.edit({
      documentId: "patches",
      anchorTag: read.anchorTag,
      patch: "PUT >3*:\n+[P1] 用例新",
    })

    expect(parseTreeHashlinePatch("PUT >3:\n+[P1] 用例新")?.[0]?.kind).toBe("insert-after")
    expect(parseTreeHashlinePatch("PUT >3*:\n+[P1] 用例新")?.[0]?.kind).toBe("insert-after")
    expect(root.children[0]?.children.map(node => node.data.text)).toEqual([
      "用例A",
      "用例新",
      "用例B",
    ])
  })

  it("restores a replaced middle subtree at its original UID and index when insertion fails", async () => {
    const initial = {
      data: { uid: "root", text: "文档" },
      children: [
        {
          data: { uid: "module", text: "模块", icon: ["sign_2"] },
          children: [
            { data: { uid: "case-a", text: "用例A", icon: ["priority_1"] }, children: [] },
            {
              data: { uid: "case-b", text: "用例B", icon: ["priority_1"] },
              children: [{ data: { uid: "step-b", text: "步骤B" }, children: [] }],
            },
            { data: { uid: "case-c", text: "用例C", icon: ["priority_1"] }, children: [] },
          ],
        },
      ],
    }
    const { portal, root, session, mindMap } = registerLivePortal(structuredClone(initial), 2)
    const read = portal.read({ documentId: "patches", view: "subtree" })
    const patch = "PUT 4.=4:\n+[P2] 新用例\n+  新步骤"
    const preview = await portal.edit({
      documentId: "patches",
      anchorTag: read.anchorTag,
      patch,
      preview: true,
    })

    await expect(
      portal.edit({
        documentId: "patches",
        anchorTag: read.anchorTag,
        patch,
        confirmationToken: preview.preview?.confirmationToken,
      })
    ).rejects.toThrow("engine failure")

    expect(root).toEqual(initial)
    expect(session.getState().dirty).toBe(false)
    expect(mindMap.command.addHistory).not.toHaveBeenCalled()
  })

  it("restores a cut middle sibling at its original index after a later failure", async () => {
    const initial = {
      data: { uid: "root", text: "文档" },
      children: [
        {
          data: { uid: "module-a", text: "模块A", icon: ["sign_2"] },
          children: [
            { data: { uid: "case-a", text: "用例A", icon: ["priority_1"] }, children: [] },
            { data: { uid: "case-b", text: "用例B", icon: ["priority_1"] }, children: [] },
            { data: { uid: "case-c", text: "用例C", icon: ["priority_1"] }, children: [] },
          ],
        },
        { data: { uid: "module-b", text: "模块B", icon: ["sign_2"] }, children: [] },
      ],
    }
    const { portal, root } = registerLivePortal(structuredClone(initial), 2)
    const read = portal.read({ documentId: "patches", view: "subtree" })
    const patch = "CUT 4:\nPUT <2:\n+# 模块C"
    const preview = await portal.edit({
      documentId: "patches",
      anchorTag: read.anchorTag,
      patch,
      preview: true,
    })

    await expect(
      portal.edit({
        documentId: "patches",
        anchorTag: read.anchorTag,
        patch,
        confirmationToken: preview.preview?.confirmationToken,
      })
    ).rejects.toThrow("engine failure")
    expect(root.children[0]?.children.map(node => node.data.text)).toEqual([
      "用例A",
      "用例B",
      "用例C",
    ])
  })
  it("moves subtrees, rejects invalid structural patches, and rolls back a later engine failure", async () => {
    const initial = {
      data: { uid: "root", text: "文档" },
      children: [
        {
          data: { uid: "module-a", text: "模块A", icon: ["sign_2"] },
          children: [
            { data: { uid: "case-a", text: "用例A", icon: ["priority_1"] }, children: [] },
          ],
        },
        { data: { uid: "module-b", text: "模块B", icon: ["sign_2"] }, children: [] },
      ],
    }
    const moved = registerLivePortal(structuredClone(initial))
    const moveRead = moved.portal.read({ documentId: "patches", view: "subtree" })
    await moved.portal.edit({
      documentId: "patches",
      anchorTag: moveRead.anchorTag,
      patch: "MOVE 3 -> 4:",
    })
    expect(moved.root.children[1]?.children[0]?.data.text).toBe("用例A")
    const invalidRead = moved.portal.read({ documentId: "patches", view: "subtree" })
    await expect(
      moved.portal.edit({
        documentId: "patches",
        anchorTag: invalidRead.anchorTag,
        patch: "MOVE 2 -> 3:",
      })
    ).rejects.toMatchObject({ code: "INVALID_DOCUMENT_EDIT_PATCH" })
    const failed = registerLivePortal(structuredClone(initial), 2)
    const failedRead = failed.portal.read({ documentId: "patches", view: "subtree" })
    await expect(
      failed.portal.edit({
        documentId: "patches",
        anchorTag: failedRead.anchorTag,
        patch: "PUT 3.=3:\n+已改\nPUT 4.=4:\n+[P1] 新用例",
      })
    ).rejects.toThrow("engine failure")
    expect(failed.root).toEqual(initial)
    expect(failed.session.getState().dirty).toBe(false)
    expect(failed.mindMap.command.addHistory).not.toHaveBeenCalled()
  })
  it("commits a successful multi-operation patch as one dirty history entry", async () => {
    const { portal, session, mindMap, root } = registerLivePortal({
      data: { uid: "root", text: "文档" },
      children: [
        {
          data: { uid: "module", text: "模块", icon: ["sign_2"] },
          children: [
            {
              data: { uid: "case", text: "旧用例", icon: ["priority_1"] },
              children: [{ data: { uid: "step", text: "旧步骤" }, children: [] }],
            },
          ],
        },
      ],
    })
    const read = portal.read({ documentId: "patches", view: "subtree" })
    const patch = "PUT 3.=3:\n+[P2] 已更新\n+  步骤一\n+  步骤二\nPUT >3:\n+[P1] 新用例\n+  新步骤"
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
      confirmationToken: preview.preview?.confirmationToken,
    })
    expect(root.children[0]?.children.map(node => node.data.text)).toEqual(["已更新", "新用例"])
    expect(root.children[0]?.children[0]?.children.map(node => node.data.text)).toEqual([
      "步骤一",
      "步骤二",
    ])
    expect(session.getState().dirty).toBe(true)
    expect(mindMap.command.addHistory).toHaveBeenCalledTimes(1)
    expect(mindMap.command.pause).toHaveBeenCalledOnce()
    expect(mindMap.command.recovery).toHaveBeenCalledOnce()
  })
})
