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
  CurrentDocumentReadToolInputSchema,
  CurrentDocumentSearchToolInputSchema,
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

  it("round-trips a destructive preview confirmation token through the public adapter", async () => {
    const preview = {
      documentId: "payments",
      revision: 1,
      dirty: false,
      preview: {
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
        confirmationToken: "confirm-delete-refund",
      },
    }
    const confirmed = { documentId: "payments", revision: 2, dirty: true }
    const portal = createPortal()
    vi.mocked(portal.edit).mockResolvedValueOnce(preview).mockResolvedValueOnce(confirmed)

    const previewResult = await executeDocumentPortalTool(
      "edit",
      { documentId: "payments", anchorTag: "anchor", patch: "CUT 3:", preview: true },
      portal
    )
    if (
      !previewResult.preview ||
      typeof previewResult.preview !== "object" ||
      !("confirmationToken" in previewResult.preview) ||
      typeof previewResult.preview.confirmationToken !== "string"
    ) {
      throw new Error("Destructive preview must include a confirmation token")
    }
    const confirmationToken = previewResult.preview.confirmationToken

    expect(confirmationToken).toBe("confirm-delete-refund")
    await expect(
      executeDocumentPortalTool(
        "edit",
        { documentId: "payments", anchorTag: "anchor", patch: "CUT 3:", confirmationToken },
        portal
      )
    ).resolves.toEqual({ success: true, ...confirmed })
    expect(portal.edit).toHaveBeenLastCalledWith({
      documentId: "payments",
      anchorTag: "anchor",
      patch: "CUT 3:",
      confirmationToken: "confirm-delete-refund",
    })
  })
})

describe("built-in current-document adapter", () => {
  it("omits documentId from the model input and injects the ready active document", () => {
    const registry = createProjectSessionRegistry()
    const session = createProjectSessionStore("payments")
    session.getState().setLifecycle(PROJECT_SESSION_LIFECYCLE.READY)
    registry.register(session)
    registry.setActive("payments")
    const portal = createPortal()

    expect(CurrentDocumentSearchToolInputSchema.safeParse({ query: "checkout" }).success).toBe(true)
    expect(
      CurrentDocumentSearchToolInputSchema.safeParse({ documentId: "payments", query: "checkout" })
        .success
    ).toBe(false)
    expect(CurrentDocumentReadToolInputSchema.safeParse({ view: "outline" }).success).toBe(true)
    expect(
      CurrentDocumentReadToolInputSchema.safeParse({ documentId: "payments", view: "outline" })
        .success
    ).toBe(false)
    expect(
      CurrentDocumentEditToolInputSchema.safeParse({ anchorTag: "a1", patch: "PUT 1.=1:\n+next" })
        .success
    ).toBe(true)
    expect(
      CurrentDocumentEditToolInputSchema.safeParse({
        anchorTag: "a1",
        patch: "PUT 1.=1:\n+next",
        confirmationToken: "confirm",
      }).success
    ).toBe(true)
    expect(
      CurrentDocumentEditToolInputSchema.safeParse({
        documentId: "payments",
        anchorTag: "a1",
        patch: "PUT 1.=1:\n+next",
      }).success
    ).toBe(false)
    expect(
      executeCurrentDocumentPortalTool("read", { view: "outline" }, { portal, registry })
    ).toMatchObject({
      success: true,
    })
    expect(portal.read).toHaveBeenCalledWith({ documentId: "payments", view: "outline" })
  })

  it("returns a not-open error when there is no active document", () => {
    expect(
      executeCurrentDocumentPortalTool(
        "read",
        { view: "outline" },
        { portal: createPortal(), registry: createProjectSessionRegistry() }
      )
    ).toMatchObject({ success: false, errorCode: "DOCUMENT_NOT_OPEN" })
  })

  it("returns a not-ready error when the active document cannot be read", () => {
    const registry = createProjectSessionRegistry()
    const session = createProjectSessionStore("loading")
    registry.register(session)
    registry.setActive("loading")

    expect(
      executeCurrentDocumentPortalTool(
        "read",
        { view: "outline" },
        { portal: createPortal(), registry }
      )
    ).toMatchObject({
      success: false,
      errorCode: "DOCUMENT_NOT_READY",
    })
  })

  it("maps an asynchronous current-document edit error to its stable response", async () => {
    const registry = createProjectSessionRegistry()
    const session = createProjectSessionStore("payments")
    session.getState().setLifecycle(PROJECT_SESSION_LIFECYCLE.READY)
    registry.register(session)
    registry.setActive("payments")
    const portal = createPortal()
    vi.mocked(portal.edit).mockRejectedValueOnce(
      new DocumentPortalError("DOCUMENT_EDIT_CONFLICT", "Document changed since this line was read")
    )

    await expect(
      executeCurrentDocumentPortalTool(
        "edit",
        { anchorTag: "anchor", patch: "PUT 1.=1:\n+next" },
        { portal, registry }
      )
    ).resolves.toEqual({
      success: false,
      error: "Document changed since this line was read",
      errorCode: "DOCUMENT_EDIT_CONFLICT",
    })
  })

  it("exposes only the current-document read tool to the built-in model", () => {
    const tools = getAgentTools()

    expect(tools).not.toHaveProperty("documents")
  })
})
