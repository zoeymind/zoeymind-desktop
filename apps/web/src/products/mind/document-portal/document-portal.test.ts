import type MindMap from "simple-mind-map"
import { describe, expect, it, vi } from "vitest"
import {
  PROJECT_SESSION_LIFECYCLE,
  createProjectSessionRegistry,
  createProjectSessionStore,
} from "@/products/mind/editor-session"
import type { OpenTab } from "@/shared/tabs/store"
import { createMindMapDocumentPortal } from "./mindmap-document-portal"
import {
  explainInvalidTreeHashlinePatch,
  parseTreeHashlinePatch,
} from "./patch/tree-hashline-patch"

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

function createStatefulMindMap(root: RuntimeNode, throwOnCommand?: number | number[]) {
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
    nodeData: node,
  })
  const historyCheckpoint = structuredClone(root)
  const restoreCheckpoint = () => {
    const restored = structuredClone(historyCheckpoint)
    root.data = restored.data
    root.children = restored.children
  }
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
    command: {
      value: {
        pause: vi.fn(),
        recovery: vi.fn(),
        addHistory: vi.fn(),
        commitHistoryNow: vi.fn(),
        restoreCurrentHistory: vi.fn(restoreCheckpoint),
      },
    },
    execCommand: {
      value: vi.fn((command: string, ...args: unknown[]) => {
        commandCount += 1
        if (
          (Array.isArray(throwOnCommand) ? throwOnCommand : [throwOnCommand]).includes(commandCount)
        )
          throw new Error("engine failure")
        if (command === "PATCH_NODE_DATA_TREE") (args[0] as (ownedRoot: RuntimeNode) => void)(root)
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
        if (command === "MOVE_NODE_DATA_TO_INDEX") {
          const node = args[0] as RuntimeNode
          const oldParent = args[1] as RuntimeNode
          const newParent = args[2] as RuntimeNode
          oldParent.children = oldParent.children.filter(child => child !== node)
          newParent.children.splice(Number(args[3]), 0, node)
        }
      }),
    },
  })
  return { mindMap, root }
}

function registerLivePortal(
  root: Parameters<typeof createStatefulMindMap>[0],
  throwOnCommand?: number | number[]
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

  it("shows nested case titles in outline reads without exposing steps", () => {
    const tabs: OpenTab[] = [{ id: "payments", kind: "file", title: "支付测试" }]
    const { portal, registry } = createPortalFixture({ tabs })
    const session = createProjectSessionStore("payments")
    session.getState().setLifecycle(PROJECT_SESSION_LIFECYCLE.READY)
    session.getState().setMindMap(
      createMindMap({
        data: { text: "支付测试" },
        children: [
          {
            data: { text: "订单", icon: ["sign_2"] },
            children: [
              {
                data: { text: "退款", icon: ["sign_2"] },
                children: [
                  {
                    data: { text: "申请退款 & 已支付", icon: ["priority_1"] },
                    children: [{ data: { text: "点击退款 & 显示确认框" }, children: [] }],
                  },
                  { data: { text: "退款超时", icon: ["priority_2"] }, children: [] },
                ],
              },
            ],
          },
          { data: { text: "账户", icon: ["sign_2"] }, children: [] },
        ],
      })
    )
    registry.register(session)

    expect(portal.read({ documentId: "payments", view: "outline" }).content).toBe(
      [
        "1: # 支付测试",
        "2:   # 订单",
        "3:     # 退款",
        "4:       [P1] 申请退款 & 已支付",
        "5:       [P2] 退款超时",
        "6:   # 账户",
      ].join("\n")
    )
  })

  it("uses displayed outline case lines as edit anchors", async () => {
    const root = {
      data: { uid: "root", text: "根" },
      children: [
        {
          data: { uid: "module", text: "模块", icon: ["sign_2"] },
          children: [
            { data: { uid: "case-a", text: "用例A", icon: ["priority_1"] }, children: [] },
          ],
        },
      ],
    }
    const { portal } = registerLivePortal(root)
    const read = portal.read({ documentId: "patches", view: "outline" })
    expect(read.content).toContain("3:     [P1] 用例A")

    await portal.edit({
      documentId: "patches",
      anchorTag: read.anchorTag,
      patch: "PUT 3.=3:\n+[P1] 已更新用例A",
    })

    expect(root.children[0]?.children[0]?.data.text).toBe("已更新用例A")
  })

  it("does not traverse hidden case steps while building a bounded outline", () => {
    const hiddenStep = {
      get data(): never {
        throw new Error("outline traversed a hidden case step")
      },
      children: [],
    }
    const tabs: OpenTab[] = [{ id: "bounded", kind: "file", title: "Bounded" }]
    const { portal, registry } = createPortalFixture({ tabs })
    const session = createProjectSessionStore("bounded")
    session.getState().setLifecycle(PROJECT_SESSION_LIFECYCLE.READY)
    session.getState().setMindMap(
      createMindMap({
        data: { text: "Bounded" },
        children: [
          {
            data: { uid: "module", text: "模块", icon: ["sign_2"] },
            children: [
              {
                data: { uid: "case", text: "用例", icon: ["priority_1"] },
                children: [hiddenStep],
              },
            ],
          },
        ],
      })
    )
    registry.register(session)

    expect(portal.read({ documentId: "bounded", view: "outline" }).content).toContain(
      "3:     [P1] 用例"
    )
  })

  it("inserts a multi-level UI module tree after an outline module line", async () => {
    const root = {
      data: { uid: "root", text: "XX模块" },
      children: [
        {
          data: { uid: "module-d", text: "核心模块D", icon: ["sign_2"] },
          children: [
            {
              data: { uid: "case-d", text: "测试标题2 & 前置条件2", icon: ["priority_2"] },
              children: [],
            },
          ],
        },
      ],
    }
    const { portal } = registerLivePortal(root)
    const read = portal.read({ documentId: "patches", view: "outline" })
    expect(read.content).toContain("2:   # 核心模块D")

    await portal.edit({
      documentId: "patches",
      anchorTag: read.anchorTag,
      patch: [
        "PUT >2:",
        "+  # 朋友圈首页",
        "+    # 动态卡片",
        "+      # 点赞按钮",
        "+        [P1] 点赞按钮-点赞动态 & 已登录且当前动态未点赞",
        "+          点击动态卡片底部的“点赞”按钮 & 按钮切换为已点赞状态，点赞数增加1",
        "+          刷新朋友圈首页 & 该动态仍保持已点赞状态，点赞数与刷新前一致",
      ].join("\n"),
    })

    expect(root.children).toHaveLength(2)
    expect(JSON.stringify(root.children[1])).toContain("朋友圈首页")
    expect(JSON.stringify(root.children[1])).toContain("点赞按钮-点赞动态")
  })

  it("explains how to replace Git Patch and natural-language edit syntax", async () => {
    const root = {
      data: { uid: "root", text: "根" },
      children: [{ data: { uid: "module", text: "模块", icon: ["sign_2"] }, children: [] }],
    }
    const { portal } = registerLivePortal(root)
    const read = portal.read({ documentId: "patches", view: "outline" })

    await expect(
      portal.edit({
        documentId: "patches",
        anchorTag: read.anchorTag,
        patch: "*** Begin Patch\n*** Update File\n@@\n+  # 新模块\n*** End Patch",
      })
    ).rejects.toThrow("Git Patch is not valid Tree Hashline syntax")

    await expect(
      portal.edit({
        documentId: "patches",
        anchorTag: read.anchorTag,
        patch: "ADD AFTER line 2:\n+  # 新模块",
      })
    ).rejects.toThrow("ADD AFTER is not valid Tree Hashline syntax")
  })

  it("reports the first invalid patch line and accepts transport line endings", () => {
    expect(explainInvalidTreeHashlinePatch("PUT >2: module")).toContain(
      'Patch line 1 is invalid: "PUT >2: module"'
    )
    expect(explainInvalidTreeHashlinePatch("PUT >2:\nmodule")).toContain(
      "Patch line 1 has no +tree body"
    )
    expect(explainInvalidTreeHashlinePatch("PUT >2:\n+ # odd indent")).toContain(
      "Patch line 2 has invalid tree indentation"
    )
    expect(explainInvalidTreeHashlinePatch("PUT >2:\nmodule")).toContain("+  # 新模块")
    expect(parseTreeHashlinePatch("PUT >2:\r\n+  # 新模块\r\n")).toMatchObject([
      { kind: "insert-after", start: 2, nodes: [{ text: "新模块" }] },
    ])
  })

  it("pinpoints an operation line hidden inside a +tree body instead of claiming the patch is empty", () => {
    const merged = [
      "PUT <2:",
      "+  # 模块A",
      "+    [P1] 用例A & 前置条件",
      "+PUT >8:",
      "+  # 模块B",
    ].join("\n")
    expect(parseTreeHashlinePatch(merged)).toBeNull()
    const explained = explainInvalidTreeHashlinePatch(merged)
    expect(explained).toContain('Patch line 4: "+PUT >8:"')
    expect(explained).toContain("must not start with '+'")
    expect(explained).not.toContain("Patch is empty")
  })

  it("pinpoints the body row whose indentation has no parent", () => {
    const orphan = "PUT <2:\n+  # 模块\n+      跳两级 & x"
    expect(parseTreeHashlinePatch(orphan)).toBeNull()
    expect(explainInvalidTreeHashlinePatch(orphan)).toContain(
      "Patch line 3 has invalid tree indentation"
    )
  })

  it("rejects a +tree body after CUT with a specific message", () => {
    const cutWithBody = "CUT 3:\n+  # 模块"
    expect(parseTreeHashlinePatch(cutWithBody)).toBeNull()
    expect(explainInvalidTreeHashlinePatch(cutWithBody)).toContain("CUT and MV take no +tree body")
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
    const nodeData = { data: { uid: "private-node", text: "支付用例" }, children: [] }
    const node = {
      uid: "private-node",
      getData: vi.fn(() => "支付用例"),
      nodeData,
    }
    const mindMap = createMindMap({
      data: { text: "电商测试" },
      children: [nodeData],
    }) as EditableMindMap
    Object.defineProperties(mindMap, {
      renderer: { value: { findNodeByUid: vi.fn(() => node) } },
      command: {
        value: {
          pause: vi.fn(),
          recovery: vi.fn(),
          addHistory: vi.fn(),
          commitHistoryNow: vi.fn(),
          restoreCurrentHistory: vi.fn(),
        },
      },
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
    expect(mindMap.execCommand).toHaveBeenCalledWith("PATCH_NODE_DATA_TREE", expect.any(Function))
    expect(mindMap.command.pause).toHaveBeenCalledOnce()
    expect(mindMap.command.recovery).toHaveBeenCalledOnce()
    expect(mindMap.command.commitHistoryNow).toHaveBeenCalledTimes(2)
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
    const patch = "PUT 3.=3:\n+[P1] 新用例\n+  操作一 & 预期一\n+  操作二 & 预期二"
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
    expect(root.children[0]?.children[0]?.data.text).toBe("新用例")
    expect(root.children[0]?.children[0]?.children.map(node => node.data.text)).toEqual([
      "操作一 & 预期一",
      "操作二 & 预期二",
    ])
  })

  it("applies a new case without steps and returns a localized repair warning", async () => {
    const { portal, root, mindMap } = registerLivePortal({
      data: { uid: "root", text: "文档" },
      children: [
        {
          data: { uid: "module", text: "模块", icon: ["sign_2"] },
          children: [
            {
              data: { uid: "case", text: "已有用例", icon: ["priority_1"] },
              children: [{ data: { uid: "step", text: "操作 & 预期" }, children: [] }],
            },
          ],
        },
      ],
    })
    const read = portal.read({ documentId: "patches", view: "outline" })

    const result = await portal.edit({
      documentId: "patches",
      anchorTag: read.anchorTag,
      patch: "PUT >3:\n+[P3] 不完整用例 & 前置条件",
    })

    expect(root.children[0]?.children).toHaveLength(2)
    expect(mindMap.execCommand).toHaveBeenCalledOnce()
    expect(result.diagnostics).toEqual([
      expect.objectContaining({
        severity: "warning",
        code: "CASE_HAS_NO_STEPS",
        path: ["模块", "不完整用例 & 前置条件"],
        line: 4,
        repairPatchHint: "PUT 4.=4:\n+[P3] 不完整用例 & 前置条件\n+  操作 & 预期结果",
      }),
    ])
  })

  it("marks outline as structure-only and subtree as complete replacement evidence", () => {
    const { portal } = registerLivePortal({
      data: { uid: "root", text: "文档" },
      children: [
        {
          data: { uid: "module", text: "模块", icon: ["sign_2"] },
          children: [
            {
              data: { uid: "case", text: "用例", icon: ["priority_1"] },
              children: [{ data: { uid: "step", text: "操作 & 预期" }, children: [] }],
            },
          ],
        },
      ],
    })

    expect(portal.read({ documentId: "patches", view: "outline" })).toMatchObject({
      completeness: "structure-only",
      canReplaceCompleteSubtree: false,
    })
    expect(portal.read({ documentId: "patches", view: "subtree" })).toMatchObject({
      completeness: "complete",
      canReplaceCompleteSubtree: true,
    })
    expect(portal.read({ documentId: "patches", view: "subtree", maxLines: 2 })).toMatchObject({
      completeness: "complete",
      truncated: true,
      canReplaceCompleteSubtree: false,
    })
  })

  it("treats adding steps to an unchanged empty case as non-destructive", async () => {
    const { portal, root } = registerLivePortal({
      data: { uid: "root", text: "文档" },
      children: [
        {
          data: { uid: "module", text: "模块", icon: ["sign_2"] },
          children: [
            { data: { uid: "case", text: "草稿用例", icon: ["priority_2"] }, children: [] },
          ],
        },
      ],
    })
    const read = portal.read({ documentId: "patches", view: "subtree" })
    const result = await portal.edit({
      documentId: "patches",
      anchorTag: read.anchorTag,
      patch: "PUT 3.=3:\n+[P2] 草稿用例\n+  执行操作 & 得到结果",
    })

    expect(result.changeSummary.destructive).toBe(false)
    expect(result.diagnostics).toEqual([])
    expect(root.children[0]?.children[0]?.children[0]?.data.text).toBe("执行操作 & 得到结果")
  })

  it("explains that sibling insertion must anchor a peer rather than its child", async () => {
    const { portal } = registerLivePortal({
      data: { uid: "root", text: "文档" },
      children: [
        {
          data: { uid: "module", text: "模块", icon: ["sign_2"] },
          children: [
            {
              data: { uid: "case", text: "已有用例", icon: ["priority_1"] },
              children: [{ data: { uid: "step", text: "操作 & 预期" }, children: [] }],
            },
          ],
        },
      ],
    })
    const read = portal.read({ documentId: "patches", view: "subtree" })

    await expect(
      portal.edit({
        documentId: "patches",
        anchorTag: read.anchorTag,
        patch: "PUT >4:\n+[P2] 新用例\n+  操作 & 预期",
      })
    ).rejects.toMatchObject({
      code: "INVALID_DOCUMENT_EDIT_PATCH",
      message: expect.stringContaining("PUT >N inserts a sibling"),
    })
    expect.assertions(1)
  })

  it("allows an existing incomplete case title to change without replacing its structure", async () => {
    const { portal, root } = registerLivePortal({
      data: { uid: "root", text: "文档" },
      children: [
        {
          data: { uid: "module", text: "模块", icon: ["sign_2"] },
          children: [
            { data: { uid: "legacy-case", text: "历史草稿", icon: ["priority_1"] }, children: [] },
          ],
        },
      ],
    })
    const read = portal.read({ documentId: "patches", view: "outline" })

    await portal.edit({
      documentId: "patches",
      anchorTag: read.anchorTag,
      patch: "PUT 3.=3:\n+[P2] 历史草稿改名",
    })
    expect(root.children[0]?.children[0]?.data.text).toBe("历史草稿改名")
    expect(root.children[0]?.children[0]?.children).toEqual([])
  })
  it("applies a new incomplete step and returns a localized replacement warning", async () => {
    const { portal, root, mindMap } = registerLivePortal({
      data: { uid: "root", text: "文档" },
      children: [
        {
          data: { uid: "module", text: "模块", icon: ["sign_2"] },
          children: [
            {
              data: { uid: "case", text: "已有用例", icon: ["priority_1"] },
              children: [{ data: { uid: "step", text: "操作 & 预期" }, children: [] }],
            },
          ],
        },
      ],
    })
    const read = portal.read({ documentId: "patches", view: "outline" })

    const result = await portal.edit({
      documentId: "patches",
      anchorTag: read.anchorTag,
      patch: "PUT >3:\n+[P2] 新用例 & 前置条件\n+  只有操作没有预期",
      returnView: { view: "subtree" },
    })

    expect(root.children[0]?.children).toHaveLength(2)
    expect(mindMap.execCommand).toHaveBeenCalledOnce()
    expect(result.diagnostics).toEqual([
      expect.objectContaining({
        severity: "warning",
        code: "STEP_HAS_NO_EXPECTED_RESULT",
        path: ["模块", "新用例 & 前置条件", "只有操作没有预期"],
        line: 5,
        repairPatchHint: "PUT 5.=5:\n+只有操作没有预期 & 预期结果",
      }),
    ])
  })

  it("commits a reviewed deletion without retransmitting its patch", async () => {
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
    expect(preview).toMatchObject({
      phase: "preview",
      changeSummary: {
        destructive: true,
        affectedNodes: expect.arrayContaining([
          expect.objectContaining({ path: ["模块", "用例"], count: 2 }),
        ]),
      },
      confirmationToken: expect.any(String),
    })
    await expect(
      portal.edit({ documentId: "patches", anchorTag: read.anchorTag, patch: "CUT 3:" })
    ).rejects.toMatchObject({ code: "DOCUMENT_PREVIEW_REQUIRED" })
    expect(root.children[0]?.children).toHaveLength(1)
    await portal.edit({
      documentId: "patches",
      confirmationToken: preview.confirmationToken,
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
        confirmationToken: preview.confirmationToken,
      })
    ).rejects.toMatchObject({ code: "DOCUMENT_EDIT_CONFLICT" })
    expect(root.children[0]?.children).toHaveLength(1)
  })

  it("rejects replaying a consumed edit review", async () => {
    const { portal } = registerLivePortal({
      data: { uid: "root", text: "文档" },
      children: [
        {
          data: { uid: "module", text: "模块", icon: ["sign_2"] },
          children: [{ data: { uid: "case", text: "用例", icon: ["priority_1"] }, children: [] }],
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
    await portal.edit({ documentId: "patches", confirmationToken: preview.confirmationToken })
    await expect(
      portal.edit({ documentId: "patches", confirmationToken: preview.confirmationToken })
    ).rejects.toMatchObject({ code: "DOCUMENT_PREVIEW_REQUIRED" })
  })

  it("accepts root labels and slash sentinels as public root paths", () => {
    const { portal } = registerLivePortal({
      data: { uid: "root", text: "XX模块" },
      children: [{ data: { uid: "module", text: "核心模块", icon: ["sign_2"] }, children: [] }],
    })

    expect(
      portal.read({ documentId: "patches", view: "subtree", path: ["XX模块"] }).content
    ).toContain("XX模块")
    expect(
      portal.search({
        documentId: "patches",
        query: "核心模块",
        scope: ["/"],
        fields: ["module"],
      }).total
    ).toBe(1)
  })

  it("normalizes a full visible root range into a root-content replacement", async () => {
    const { portal, root } = registerLivePortal({
      data: { uid: "root", text: "旧文档" },
      children: [
        {
          data: { uid: "module", text: "旧模块", icon: ["sign_2"] },
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
    const patch =
      "PUT 1.=4:\n+朋友圈首页\n+  # 动态卡片\n+    # 点赞按钮\n+      [P1] 点赞好友动态 & 已登录\n+        点击点赞按钮 & 点赞数增加 1"

    const preview = await portal.edit({
      documentId: "patches",
      anchorTag: read.anchorTag,
      patch,
      preview: true,
      confirmationToken: ":preview:",
    })

    expect(preview).toMatchObject({
      phase: "preview",
      changeSummary: { destructive: true, removedNodes: 3 },
      confirmationToken: expect.any(String),
    })
    expect(root.data).toEqual({ uid: "root", text: "旧文档" })
    await portal.edit({
      documentId: "patches",
      anchorTag: read.anchorTag,
      patch,
      confirmationToken: preview.confirmationToken,
    })
    expect(root.data).toEqual({ uid: "root", text: "朋友圈首页" })
    expect(root.children[0]?.data.text).toBe("动态卡片")
    expect(root.children[0]?.children[0]?.data.text).toBe("点赞按钮")
    expect(root.children[0]?.children[0]?.children[0]?.data.text).toBe("点赞好友动态 & 已登录")
  })

  it("normalizes a single-line structural PUT on root into the same root-content replacement", async () => {
    const { portal, root } = registerLivePortal({
      data: { uid: "root", text: "旧文档" },
      children: [{ data: { uid: "module", text: "旧模块", icon: ["sign_2"] }, children: [] }],
    })
    const read = portal.read({ documentId: "patches", view: "subtree" })
    const patch = "PUT 1.=1:\n+朋友圈首页\n+  # 动态卡片"
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
    expect(root.data).toEqual({ uid: "root", text: "朋友圈首页" })
    expect(root.children.map(node => node.data.text)).toEqual(["动态卡片"])
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
    const { portal, root } = registerLivePortal(structuredClone(initial), 1)
    const read = portal.read({ documentId: "patches", view: "subtree" })

    await expect(
      portal.edit({
        documentId: "patches",
        anchorTag: read.anchorTag,
        patch:
          "PUT >3:\n+[P1] 用例A\n+  操作A & 预期A\nPUT >3:\n+[P1] 用例B\n+  操作B & 预期B\nPUT >3:\n+[P1] 用例C\n+  操作C & 预期C",
      })
    ).rejects.toThrow("engine failure")
    expect(root).toEqual(initial)
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
      confirmationToken: preview.confirmationToken,
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
      patch: "PUT >3*:\n+[P1] 用例新\n+  新操作 & 新预期",
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
    const { portal, root, session, mindMap } = registerLivePortal(structuredClone(initial), 1)
    const read = portal.read({ documentId: "patches", view: "subtree" })
    const patch = "PUT 4.=4:\n+[P2] 新用例\n+  新操作 & 新预期"
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
        confirmationToken: preview.confirmationToken,
      })
    ).rejects.toThrow("engine failure")

    expect(root).toEqual(initial)
    expect(session.getState().dirty).toBe(false)
    expect(mindMap.command.commitHistoryNow).toHaveBeenCalledOnce()
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
    const { portal, root } = registerLivePortal(structuredClone(initial), 1)
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
        confirmationToken: preview.confirmationToken,
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
    const failed = registerLivePortal(structuredClone(initial), 1)
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
    expect(failed.mindMap.command.commitHistoryNow).toHaveBeenCalledOnce()
  })
  it("reports a consistency error when an inverse command also fails", async () => {
    const fixture = registerLivePortal(
      {
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
      },
      [1, 2]
    )
    const read = fixture.portal.read({ documentId: "patches", view: "subtree" })

    await expect(
      fixture.portal.edit({
        documentId: "patches",
        anchorTag: read.anchorTag,
        patch: "PUT 3.=3:\n+已改\nPUT 4.=4:\n+也已改",
      })
    ).rejects.toMatchObject({ code: "DOCUMENT_CONSISTENCY_ERROR" })
    expect(fixture.mindMap.execCommand).toHaveBeenCalledTimes(2)
    expect(fixture.session.getState().dirty).toBe(false)
  })
  it("updates case priority during a single-line Tree Hashline replacement", async () => {
    const { portal, root } = registerLivePortal({
      data: { uid: "root", text: "文档" },
      children: [
        {
          data: { uid: "module", text: "模块", icon: ["sign_2"] },
          children: [
            {
              data: { uid: "case", text: "用例", icon: ["priority_2"] },
              children: [{ data: { uid: "step", text: "操作 & 预期" }, children: [] }],
            },
          ],
        },
      ],
    })
    const read = portal.read({ documentId: "patches", view: "subtree" })

    await portal.edit({
      documentId: "patches",
      anchorTag: read.anchorTag,
      patch: "PUT 3.=3:\n+[P1] 用例",
    })

    expect(root.children[0]?.children[0]?.data.icon).toEqual(["priority_1"])
    expect(portal.read({ documentId: "patches", view: "outline" }).content).toContain("[P1] 用例")
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
    const patch =
      "PUT 3.=3:\n+[P2] 已更新\n+  操作一 & 预期一\n+  操作二 & 预期二\nPUT >3:\n+[P1] 新用例\n+  新操作 & 新预期"
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
    expect(root.children[0]?.children.map(node => node.data.text)).toEqual(["已更新", "新用例"])
    expect(root.children[0]?.children[0]?.children.map(node => node.data.text)).toEqual([
      "操作一 & 预期一",
      "操作二 & 预期二",
    ])
    expect(session.getState().dirty).toBe(true)
    expect(mindMap.command.commitHistoryNow).toHaveBeenCalledTimes(2)
    expect(mindMap.command.pause).toHaveBeenCalledOnce()
    expect(mindMap.command.recovery).toHaveBeenCalledOnce()
  })
  it("returns a new bounded view and anchor after a successful edit", async () => {
    const { portal } = registerLivePortal({
      data: { uid: "root", text: "文档" },
      children: [
        {
          data: { uid: "module", text: "模块", icon: ["sign_2"] },
          children: [{ data: { uid: "case", text: "旧用例", icon: ["priority_1"] }, children: [] }],
        },
      ],
    })
    const read = portal.read({ documentId: "patches", view: "outline" })
    const result = await portal.edit({
      documentId: "patches",
      anchorTag: read.anchorTag,
      patch: "PUT >3:\n+[P2] 新用例\n+  新操作 & 新预期",
    })

    expect(result.view).toMatchObject({
      view: "outline",
      path: ["模块"],
      content: "1: # 模块\n2:   [P1] 旧用例\n3:   [P2] 新用例",
      truncated: false,
    })
    expect(result.view?.anchorTag).not.toBe(read.anchorTag)
  })

  it("honors an explicit post-edit subtree view", async () => {
    const { portal } = registerLivePortal({
      data: { uid: "root", text: "文档" },
      children: [
        {
          data: { uid: "module", text: "模块", icon: ["sign_2"] },
          children: [{ data: { uid: "case", text: "旧用例", icon: ["priority_1"] }, children: [] }],
        },
      ],
    })
    const read = portal.read({ documentId: "patches", view: "subtree", path: ["模块"] })
    const result = await portal.edit({
      documentId: "patches",
      anchorTag: read.anchorTag,
      patch: "PUT >2:\n+[P2] 新用例\n+  操作 & 预期",
      returnView: { view: "subtree", maxLines: 20 },
    })
    expect(result.view?.content).toContain("操作 & 预期")
    expect(result.view?.path).toEqual(["模块"])
  })

  it("returns the requested local path after a cross-module edit", async () => {
    const { portal } = registerLivePortal({
      data: { uid: "root", text: "文档" },
      children: [
        {
          data: { uid: "module-a", text: "模块A", icon: ["sign_2"] },
          children: [
            { data: { uid: "case-a", text: "旧用例A", icon: ["priority_1"] }, children: [] },
          ],
        },
        {
          data: { uid: "module-b", text: "模块B", icon: ["sign_2"] },
          children: [
            { data: { uid: "case-b", text: "旧用例B", icon: ["priority_1"] }, children: [] },
          ],
        },
      ],
    })
    const read = portal.read({ documentId: "patches", view: "outline" })
    const result = await portal.edit({
      documentId: "patches",
      anchorTag: read.anchorTag,
      patch: "PUT >3:\n+[P2] 新用例A\n+  操作A & 预期A\nPUT >5:\n+[P2] 新用例B\n+  操作B & 预期B",
      returnView: { view: "subtree", path: ["模块A"], maxLines: 20 },
    })

    expect(result.view).toMatchObject({
      view: "subtree",
      path: ["模块A"],
      truncated: false,
    })
    expect(result.view?.content).toContain("新用例A")
    expect(result.view?.content).not.toContain("新用例B")
  })

  it("falls back to the affected path when the preferred return path is absent", async () => {
    const { portal } = registerLivePortal({
      data: { uid: "root", text: "文档" },
      children: [
        {
          data: { uid: "module", text: "模块", icon: ["sign_2"] },
          children: [{ data: { uid: "case", text: "旧用例", icon: ["priority_1"] }, children: [] }],
        },
      ],
    })
    const read = portal.read({ documentId: "patches", view: "outline" })
    const result = await portal.edit({
      documentId: "patches",
      anchorTag: read.anchorTag,
      patch: "PUT >3:\n+[P2] 新用例\n+  操作 & 预期",
      returnView: { view: "subtree", path: ["不存在"], maxLines: 20 },
    })

    expect(result.view).toMatchObject({ path: ["模块"], truncated: false })
    expect(result.view?.content).toContain("新用例")
  })

  it("applies precise set, move, and scoped replacement with compact receipts", async () => {
    const { portal, root } = registerLivePortal({
      data: { uid: "root", text: "文档" },
      children: [
        {
          data: { uid: "module-a", text: "模块A", icon: ["sign_2"] },
          children: [
            {
              data: { uid: "case-a", text: "旧版用例 & 旧版前置", icon: ["priority_1"] },
              children: [{ data: { uid: "step-a", text: "旧版操作 & 旧版预期" }, children: [] }],
            },
            {
              data: { uid: "case-b", text: "保留用例 & 保留前置", icon: ["priority_2"] },
              children: [],
            },
          ],
        },
        {
          data: { uid: "module-b", text: "模块B", icon: ["sign_2"] },
          children: [
            {
              data: { uid: "sentinel", text: "旧版用例 & 旧版前置", icon: ["priority_1"] },
              children: [],
            },
          ],
        },
      ],
    })
    const read = portal.read({ documentId: "patches", view: "subtree" })

    const result = await portal.edit({
      documentId: "patches",
      anchorTag: read.anchorTag,
      operations: [
        { op: "set_node", at: 4, value: "旧版操作 & 新版预期" },
        {
          op: "replace_text",
          within: 2,
          fields: ["caseTitle", "precondition"],
          find: "旧版",
          replace: "新版",
          expect: 2,
        },
        { op: "move", at: 5, to: 3, position: "before" },
      ],
    })

    expect(result).toMatchObject({
      phase: "committed",
      effects: [
        { operation: 0, nodes: 1 },
        { operation: 1, nodes: 1, matches: 2 },
        { operation: 2, nodes: 1 },
      ],
    })
    expect(result).not.toHaveProperty("view")
    expect(result.changeSummary).toEqual({ destructive: false, removedNodes: 0, affectedNodes: [] })
    expect(root.children[0]?.children.map(node => node.data.uid)).toEqual(["case-b", "case-a"])
    expect(root.children[0]?.children[1]?.data.text).toBe("新版用例 & 新版前置")
    expect(root.children[0]?.children[1]?.children[0]?.data.text).toBe("旧版操作 & 新版预期")
    expect(root.children[1]?.children[0]?.data.text).toBe("旧版用例 & 旧版前置")
  })

  it("deletes a stepped case from an unchanged outline and rejects destructive intent overlap", async () => {
    const { portal, root, mindMap } = registerLivePortal({
      data: { uid: "root", text: "文档" },
      children: [
        {
          data: { uid: "module", text: "模块", icon: ["sign_2"] },
          children: [
            {
              data: { uid: "case", text: "用例 & 前置", icon: ["priority_1"] },
              children: [{ data: { uid: "step", text: "操作 & 预期" }, children: [] }],
            },
          ],
        },
      ],
    })
    const overlapRead = portal.read({ documentId: "patches", view: "outline" })
    await expect(
      portal.edit({
        documentId: "patches",
        anchorTag: overlapRead.anchorTag,
        operations: [
          {
            op: "replace_text",
            within: 2,
            fields: ["caseTitle"],
            find: "用例",
            replace: "新用例",
            expect: 1,
          },
          { op: "delete", at: 2 },
        ],
        preview: true,
      })
    ).rejects.toMatchObject({ code: "INVALID_DOCUMENT_EDIT_PATCH" })
    expect(mindMap.execCommand).not.toHaveBeenCalled()

    const deleteRead = portal.read({ documentId: "patches", view: "outline" })
    const preview = await portal.edit({
      documentId: "patches",
      anchorTag: deleteRead.anchorTag,
      operations: [{ op: "delete", at: 3 }],
      preview: true,
    })
    expect(preview).toMatchObject({ phase: "preview", changeSummary: { removedNodes: 2 } })
    expect(preview.confirmationToken).toBeTypeOf("string")
    await portal.edit({
      documentId: "patches",
      confirmationToken: preview.confirmationToken,
    })
    expect(root.children[0]?.children).toEqual([])
  })

  it("rejects transform count drift and stale delete subtrees without mutation", async () => {
    const { portal, root, mindMap } = registerLivePortal({
      data: { uid: "root", text: "文档" },
      children: [
        {
          data: { uid: "module", text: "模块", icon: ["sign_2"] },
          children: [
            {
              data: { uid: "case", text: "旧版用例 & 前置", icon: ["priority_1"] },
              children: [{ data: { uid: "step", text: "操作 & 预期" }, children: [] }],
            },
          ],
        },
      ],
    })
    const countRead = portal.read({ documentId: "patches", view: "subtree" })
    await expect(
      portal.edit({
        documentId: "patches",
        anchorTag: countRead.anchorTag,
        operations: [
          {
            op: "replace_text",
            within: 2,
            fields: ["caseTitle"],
            find: "旧版",
            replace: "新版",
            expect: 2,
          },
        ],
      })
    ).rejects.toMatchObject({ code: "DOCUMENT_TRANSFORM_COUNT_MISMATCH" })
    expect(root.children[0]?.children[0]?.data.text).toBe("旧版用例 & 前置")

    const deleteRead = portal.read({ documentId: "patches", view: "subtree" })
    root.children[0]?.children[0]?.children.push({
      data: { uid: "concurrent-step", text: "并发操作 & 并发预期" },
      children: [],
    })
    await expect(
      portal.edit({
        documentId: "patches",
        anchorTag: deleteRead.anchorTag,
        operations: [{ op: "delete", at: 3 }],
      })
    ).rejects.toMatchObject({ code: "DOCUMENT_EDIT_CONFLICT" })
    expect(mindMap.execCommand).not.toHaveBeenCalled()
    expect(root.children[0]?.children).toHaveLength(1)
  })
})
