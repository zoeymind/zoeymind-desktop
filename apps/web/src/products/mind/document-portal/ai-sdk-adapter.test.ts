import { describe, expect, it, vi } from "vitest"
import type { DocumentPortal } from "./document-portal"
import { executeDocumentPortalTool } from "./ai-sdk-adapter"

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
    })),
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
})
