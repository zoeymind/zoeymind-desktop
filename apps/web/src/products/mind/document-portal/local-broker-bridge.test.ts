import { describe, expect, it, vi } from "vitest"
import { dispatchDocumentPortalBrokerRequest } from "./local-broker-bridge"

vi.mock("./mindmap-document-portal", () => ({
  mindMapDocumentPortal: {
    listDocuments: vi.fn(() => [{ documentId: "live" }]),
    search: vi.fn(),
    read: vi.fn(),
    edit: vi.fn(),
  },
}))

describe("local Document Portal broker bridge", () => {
  it("dispatches a broker documents request through the live Portal", async () => {
    await expect(
      dispatchDocumentPortalBrokerRequest({ requestId: "request-1", tool: "documents", input: {} })
    ).resolves.toEqual({ success: true, documents: [{ documentId: "live" }] })
  })

  it("rejects unsupported broker tools without dispatch", async () => {
    await expect(
      dispatchDocumentPortalBrokerRequest({ requestId: "request-2", tool: "unknown", input: {} })
    ).resolves.toMatchObject({ success: false, errorCode: "INVALID_REQUEST" })
  })
})
