import { describe, expect, it, vi } from "vitest"
import {
  approveCurrentDocumentEdit,
  executeCurrentDocumentPortalTool,
} from "./current-document-adapter"
import { dispatchDocumentPortalBrokerRequest } from "./local-broker-bridge"

vi.mock("./current-document-adapter", () => ({
  isCurrentDocumentPortalTool: vi.fn((tool: string) =>
    ["query_current_mindmap", "edit_current_mindmap"].includes(tool)
  ),
  executeCurrentDocumentPortalTool: vi.fn(() => ({ success: true, anchorTag: "active" })),
  approveCurrentDocumentEdit: vi.fn(async () => ({ phase: "committed" })),
}))

vi.mock("./project-controller", () => ({
  controlProjects: vi.fn(async () => ({ projects: [] })),
  activateProject: vi.fn(async (projectId: string) => ({ projectId, active: true, ready: false })),
}))

describe("local Document Portal broker bridge", () => {
  it("dispatches current-mind-map and project-control requests", async () => {
    await expect(
      dispatchDocumentPortalBrokerRequest({
        requestId: "request-1",
        tool: "query_current_mindmap",
        input: { mode: "outline" },
      })
    ).resolves.toEqual({ success: true, anchorTag: "active" })
    await expect(
      dispatchDocumentPortalBrokerRequest({
        requestId: "request-2",
        tool: "projects",
        input: { action: "list" },
      })
    ).resolves.toEqual({ success: true, projects: [] })
    await expect(
      dispatchDocumentPortalBrokerRequest({
        requestId: "request-3",
        tool: "activate_project",
        input: { projectId: "project-a" },
      })
    ).resolves.toEqual({ success: true, projectId: "project-a", active: true, ready: false })
  })

  it("returns explicit edit previews without approving or committing them", async () => {
    vi.mocked(executeCurrentDocumentPortalTool).mockResolvedValueOnce({
      success: true,
      phase: "preview",
      revision: 0,
      confirmationToken: "preview-token",
    })

    await expect(
      dispatchDocumentPortalBrokerRequest({
        requestId: "preview-request",
        tool: "edit_current_mindmap",
        input: { anchorTag: "anchor", patch: "CUT 3:", preview: true },
      })
    ).resolves.toMatchObject({ success: true, phase: "preview", revision: 0 })
    expect(executeCurrentDocumentPortalTool).toHaveBeenCalledWith("edit_current_mindmap", {
      anchorTag: "anchor",
      patch: "CUT 3:",
      preview: true,
    })
    expect(approveCurrentDocumentEdit).not.toHaveBeenCalled()
  })

  it("rejects unsupported broker tools without dispatch", async () => {
    await expect(
      dispatchDocumentPortalBrokerRequest({ requestId: "request-2", tool: "unknown", input: {} })
    ).resolves.toMatchObject({ success: false, errorCode: "INVALID_REQUEST" })
  })
})
