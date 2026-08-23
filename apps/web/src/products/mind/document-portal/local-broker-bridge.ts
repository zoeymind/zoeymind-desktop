import { listen } from "@tauri-apps/api/event"
import { invoke } from "@tauri-apps/api/core"
import { logger } from "@zoeymind/logger"
import {
  approveCurrentDocumentEdit,
  executeCurrentDocumentPortalTool,
  isCurrentDocumentPortalTool,
} from "./current-document-adapter"
import { activateProject, controlProjects } from "./project-controller"

type BrokerRequest = { requestId: string; tool: string; input: unknown }

export function startDocumentPortalBrokerBridge(): () => void {
  let disposed = false
  let unlisten: (() => void) | undefined

  void listen<BrokerRequest>("document-portal:request", async ({ payload }) => {
    const response = await dispatchDocumentPortalBrokerRequest(payload)
    if (!disposed) {
      await invoke("document_portal_respond", { requestId: payload.requestId, response })
    }
  })
    .then(stop => {
      if (disposed) stop()
      else unlisten = stop
    })
    .catch(error => logger.error("Document Portal broker bridge failed to subscribe", { error }))

  return () => {
    disposed = true
    unlisten?.()
  }
}

export async function dispatchDocumentPortalBrokerRequest(
  request: BrokerRequest
): Promise<Record<string, unknown>> {
  if (request.tool === "projects") {
    try {
      return { success: true, ...(await controlProjects(request.input as never)) }
    } catch (error) {
      return { success: false, errorCode: "PROJECT_CONTROL_FAILED", error: String(error) }
    }
  }
  if (request.tool === "activate_project") {
    try {
      const input = request.input as { projectId?: unknown }
      if (typeof input.projectId !== "string" || !input.projectId)
        return { success: false, errorCode: "INVALID_REQUEST", error: "projectId is required" }
      return { success: true, ...(await activateProject(input.projectId)) }
    } catch (error) {
      return { success: false, errorCode: "PROJECT_ACTIVATION_FAILED", error: String(error) }
    }
  }
  if (!isCurrentDocumentPortalTool(request.tool)) {
    return {
      success: false,
      errorCode: "INVALID_REQUEST",
      error: "Expected a project-control or current-mind-map tool request",
    }
  }
  try {
    if (request.tool === "edit_current_mindmap") {
      const input = request.input as Record<string, unknown>
      if (input.preview === true)
        return await Promise.resolve(executeCurrentDocumentPortalTool(request.tool, input))
      const preview = await Promise.resolve(
        executeCurrentDocumentPortalTool(request.tool, { ...input, preview: true })
      )
      if (preview.success === false) return preview
      if (typeof preview.confirmationToken !== "string")
        return await Promise.resolve(executeCurrentDocumentPortalTool(request.tool, input))
      return {
        success: true,
        ...(await approveCurrentDocumentEdit(
          preview.confirmationToken,
          input.returnView as { view?: "outline" | "subtree"; maxLines?: number } | undefined
        )),
      }
    }
    return await Promise.resolve(executeCurrentDocumentPortalTool(request.tool, request.input))
  } catch (error) {
    logger.error("Document Portal broker dispatch failed", { tool: request.tool, error })
    return { success: false, errorCode: "PORTAL_FAILURE", error: "Document Portal request failed" }
  }
}
