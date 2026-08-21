import { z } from "zod"
import { DOCUMENT_READ_VIEW, DocumentPortalError, type DocumentPortal } from "./document-portal"
import { mindMapDocumentPortal } from "./mindmap-document-portal"

export const DOCUMENT_PORTAL_TOOL_NAME = {
  DOCUMENTS: "documents",
  READ: "read",
} as const

export type DocumentPortalToolName =
  (typeof DOCUMENT_PORTAL_TOOL_NAME)[keyof typeof DOCUMENT_PORTAL_TOOL_NAME]

export const DocumentsToolInputSchema = z.object({})
export const ReadDocumentToolInputSchema = z.object({
  documentId: z.string().min(1),
  view: z.enum([DOCUMENT_READ_VIEW.OUTLINE, DOCUMENT_READ_VIEW.SUBTREE]),
  path: z.array(z.string().min(1)).optional(),
  maxLines: z.number().int().min(1).max(1_000).optional(),
})

export function isDocumentPortalTool(toolName: string): toolName is DocumentPortalToolName {
  return (
    toolName === DOCUMENT_PORTAL_TOOL_NAME.DOCUMENTS || toolName === DOCUMENT_PORTAL_TOOL_NAME.READ
  )
}

export function executeDocumentPortalTool(
  toolName: DocumentPortalToolName,
  input: unknown,
  portal: DocumentPortal = mindMapDocumentPortal
): Record<string, unknown> {
  try {
    if (toolName === DOCUMENT_PORTAL_TOOL_NAME.DOCUMENTS) {
      DocumentsToolInputSchema.parse(input)
      return { success: true, documents: portal.listDocuments() }
    }

    const request = ReadDocumentToolInputSchema.parse(input)
    return { success: true, ...portal.read(request) }
  } catch (error) {
    if (error instanceof DocumentPortalError) {
      return { success: false, error: error.message, errorCode: error.code }
    }
    throw error
  }
}
