import { listen } from "@tauri-apps/api/event"
import { invoke } from "@tauri-apps/api/core"
import { logger } from "@zoeymind/logger"
import { executeDocumentPortalTool, isDocumentPortalTool } from "./ai-sdk-adapter"
import { mindMapDocumentPortal } from "./mindmap-document-portal"

type BrokerRequest = { requestId: string; tool: string; input: unknown }

export function startDocumentPortalBrokerBridge(): void {
  void listen<BrokerRequest>("document-portal:request", async ({ payload }) => {
    const response = await dispatchDocumentPortalBrokerRequest(payload)
    await invoke("document_portal_respond", { requestId: payload.requestId, response })
  }).catch(error => logger.error("Document Portal broker bridge failed to subscribe", { error }))
}

export async function dispatchDocumentPortalBrokerRequest(
  request: BrokerRequest
): Promise<Record<string, unknown>> {
  if (!isDocumentPortalTool(request.tool)) {
    return {
      success: false,
      errorCode: "INVALID_REQUEST",
      error: "Expected a Document Portal tool request",
    }
  }
  try {
    return await Promise.resolve(
      executeDocumentPortalTool(request.tool, request.input, mindMapDocumentPortal)
    )
  } catch (error) {
    logger.error("Document Portal broker dispatch failed", { tool: request.tool, error })
    return { success: false, errorCode: "PORTAL_FAILURE", error: "Document Portal request failed" }
  }
}
