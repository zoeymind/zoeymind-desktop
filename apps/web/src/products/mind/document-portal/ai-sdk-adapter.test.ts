import { describe, expect, it, vi } from "vitest"
import { DocumentPortalError, type DocumentPortal } from "./document-portal"
import { executeDocumentPortalTool } from "./ai-sdk-adapter"
import {
  PROJECT_SESSION_LIFECYCLE,
  createProjectSessionRegistry,
  createProjectSessionStore,
} from "../editor-session"
import {
  CurrentDocumentEditToolInputSchema,
  CurrentDocumentQueryToolInputSchema,
  executeCurrentDocumentPortalTool,
} from "./current-document-adapter"
import { getAgentTools } from "../x/ai-chat/agent-tools"

function createPortal(): DocumentPortal {
  return {
    listDocuments: vi.fn(() => [
      {
        documentId: "payments",
        title: "支付测试",
        active: true,
        ready: true,
        dirty: false,
        revision: 0,
      },
    ]),
    read: vi.fn(() => ({
      documentId: "payments",
      title: "支付测试",
      revision: 0,
      view: "outline" as const,
      content: "1: # 支付测试",
      lineCount: 1,
      truncated: false,
      anchorTag: "test-anchor",
      completeness: "structure-only" as const,
      canReplaceCompleteSubtree: false,
    })),
    search: vi.fn(),
    edit: vi.fn(),
  }
}

describe("DocumentPortal AI adapter", () => {
  it("returns structured open-document state to the model", () => {
    const portal = createPortal()

    expect(executeDocumentPortalTool("documents", {}, portal)).toEqual({
      success: true,
      documents: [
        {
          documentId: "payments",
          title: "支付测试",
          active: true,
          ready: true,
          revision: 0,
          dirty: false,
        },
      ],
    })
  })

  it("requires an explicit documentId for read and forwards bounded read options", () => {
    const portal = createPortal()

    expect(
      executeDocumentPortalTool(
        "read",
        { documentId: "payments", view: "subtree", path: ["支付"], maxLines: 30 },
        portal
      )
    ).toMatchObject({ success: true })
    expect(portal.read).toHaveBeenCalledWith({
      documentId: "payments",
      view: "subtree",
      path: ["支付"],
      maxLines: 30,
    })
    expect(() => executeDocumentPortalTool("read", { view: "outline" }, portal)).toThrow(
      "documentId"
    )
  })

  it("maps an asynchronous portal edit error to its stable response", async () => {
    const portal = createPortal()
    vi.mocked(portal.edit).mockRejectedValueOnce(
      new DocumentPortalError("DOCUMENT_EDIT_CONFLICT", "Document changed since this line was read")
    )

    await expect(
      executeDocumentPortalTool(
        "edit",
        { documentId: "payments", anchorTag: "anchor", patch: "PUT 1.=1:\n+next" },
        portal
      )
    ).resolves.toEqual({
      success: false,
      error: "Document changed since this line was read",
      errorCode: "DOCUMENT_EDIT_CONFLICT",
    })
  })

  it("commits a destructive preview without retransmitting the patch", async () => {
    const preview = {
      documentId: "payments",
      revision: 1,
      dirty: false,
      phase: "preview" as const,
      changeSummary: {
        destructive: true,
        removedNodes: 2,
        affectedNodes: [
          {
            path: ["Payments", "Refund"],
            type: "case" as const,
            text: "Refund",
            depth: 0,
            count: 2,
          },
        ],
      },
      confirmationToken: "confirm-delete-refund",
      diagnostics: [],
    }
    const confirmed = {
      documentId: "payments",
      revision: 2,
      dirty: true,
      phase: "committed" as const,
      changeSummary: { destructive: true, removedNodes: 2, affectedNodes: [] },
      diagnostics: [],
    }
    const portal = createPortal()
    vi.mocked(portal.edit).mockResolvedValueOnce(preview).mockResolvedValueOnce(confirmed)

    const previewResult = await executeDocumentPortalTool(
      "edit",
      { documentId: "payments", anchorTag: "anchor", patch: "CUT 3:", preview: true },
      portal
    )
    if (previewResult.confirmationToken !== "confirm-delete-refund")
      throw new Error("Destructive preview must include a confirmation token")
    const confirmationToken = previewResult.confirmationToken
    await expect(
      executeDocumentPortalTool("edit", { documentId: "payments", confirmationToken }, portal)
    ).resolves.toEqual({ success: true, ...confirmed })
    expect(portal.edit).toHaveBeenLastCalledWith({
      documentId: "payments",
      confirmationToken: "confirm-delete-refund",
    })
  })
})

describe("built-in current-document adapter", () => {
  it("omits documentId and resolves the ready active tab directly", () => {
    const registry = createProjectSessionRegistry()
    const session = createProjectSessionStore("payments")
    session.getState().setLifecycle(PROJECT_SESSION_LIFECYCLE.READY)
    registry.register(session)
    const portal = createPortal()
    const getActiveId = () => "payments" as const

    expect(
      CurrentDocumentQueryToolInputSchema.safeParse({ mode: "search", query: "checkout" }).success
    ).toBe(true)
    expect(
      CurrentDocumentQueryToolInputSchema.safeParse({
        documentId: "payments",
        mode: "search",
        query: "checkout",
      }).success
    ).toBe(false)
    expect(CurrentDocumentQueryToolInputSchema.safeParse({ mode: "outline" }).success).toBe(true)
    expect(
      CurrentDocumentEditToolInputSchema.safeParse({ anchorTag: "a1", patch: "PUT 1.=1:\n+next" })
        .success
    ).toBe(true)
    expect(
      CurrentDocumentEditToolInputSchema.safeParse({
        anchorTag: "a1",
        operations: [{ op: "set_node", at: 2, value: "# 模块" }],
      }).success
    ).toBe(true)
    expect(
      CurrentDocumentEditToolInputSchema.safeParse({
        anchorTag: "a1",
        patch: "PUT 1.=1:\n+next",
        operations: [{ op: "delete", at: 2 }],
      }).success
    ).toBe(false)
    expect(
      CurrentDocumentEditToolInputSchema.safeParse({
        anchorTag: "a1",
        patch: "PUT 1.=1:\n+next",
        returnView: { view: "subtree", path: ["订单", "退款"] },
      }).success
    ).toBe(true)
    expect(
      CurrentDocumentEditToolInputSchema.safeParse({
        anchorTag: "a1",
        patch: "CUT 1:",
        confirmationToken: "model-must-not-see-this",
      }).success
    ).toBe(false)
    expect(
      CurrentDocumentEditToolInputSchema.safeParse({
        documentId: "payments",
        anchorTag: "a1",
        patch: "PUT 1.=1:\n+next",
      }).success
    ).toBe(false)
    expect(
      executeCurrentDocumentPortalTool(
        "query_current_mindmap",
        { mode: "outline" },
        { portal, registry, getActiveId }
      )
    ).toMatchObject({ success: true })
    expect(portal.read).toHaveBeenCalledWith({ documentId: "payments", view: "outline" })
  })

  it("returns a not-open error when there is no active document", () => {
    expect(
      executeCurrentDocumentPortalTool(
        "query_current_mindmap",
        { mode: "outline" },
        {
          portal: createPortal(),
          registry: createProjectSessionRegistry(),
          getActiveId: () => "home",
        }
      )
    ).toMatchObject({ success: false, errorCode: "DOCUMENT_NOT_OPEN" })
  })

  it("returns a not-ready error when the active document is still loading", () => {
    const registry = createProjectSessionRegistry()
    const session = createProjectSessionStore("loading")
    registry.register(session)

    expect(
      executeCurrentDocumentPortalTool(
        "query_current_mindmap",
        { mode: "outline" },
        { portal: createPortal(), registry, getActiveId: () => "loading" }
      )
    ).toMatchObject({ success: false, errorCode: "DOCUMENT_NOT_READY" })
  })

  it("maps an asynchronous current-document edit error to its stable response", async () => {
    const registry = createProjectSessionRegistry()
    const session = createProjectSessionStore("payments")
    session.getState().setLifecycle(PROJECT_SESSION_LIFECYCLE.READY)
    registry.register(session)
    const portal = createPortal()
    vi.mocked(portal.edit).mockRejectedValueOnce(
      new DocumentPortalError("DOCUMENT_EDIT_CONFLICT", "Document changed since this line was read")
    )

    await expect(
      executeCurrentDocumentPortalTool(
        "edit_current_mindmap",
        { anchorTag: "anchor", patch: "PUT 1.=1:\n+next" },
        { portal, registry, getActiveId: () => "payments" }
      )
    ).resolves.toEqual({
      success: false,
      error: "Document changed since this line was read",
      errorCode: "DOCUMENT_EDIT_CONFLICT",
    })
  })

  it("resolves the active tab directly and never falls back to the previous session", () => {
    const registry = createProjectSessionRegistry()
    const previous = createProjectSessionStore("previous")
    previous.getState().setLifecycle(PROJECT_SESSION_LIFECYCLE.READY)
    registry.register(previous)
    registry.setActive("previous")
    const portal = createPortal()

    expect(
      executeCurrentDocumentPortalTool(
        "query_current_mindmap",
        { mode: "outline" },
        { portal, registry, getActiveId: () => "opening" }
      )
    ).toMatchObject({ success: false, errorCode: "DOCUMENT_NOT_OPEN" })
    expect(portal.read).not.toHaveBeenCalled()
  })

  it("exposes only current-mind-map query and edit plus question", () => {
    expect(Object.keys(getAgentTools())).toEqual([
      "query_current_mindmap",
      "edit_current_mindmap",
      "question",
    ])
  })
})
