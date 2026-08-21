import { z } from "zod"
import { DOCUMENT_READ_VIEW, DocumentPortalError, type DocumentPortal } from "./document-portal"
import { mindMapDocumentPortal } from "./mindmap-document-portal"

export const DOCUMENT_PORTAL_TOOL_NAME = {
  DOCUMENTS: "documents",
  SEARCH: "search",
  READ: "read",
  EDIT: "edit",
} as const

export type DocumentPortalToolName =
  (typeof DOCUMENT_PORTAL_TOOL_NAME)[keyof typeof DOCUMENT_PORTAL_TOOL_NAME]

export const DocumentsToolInputSchema = z.object({})
export const SearchDocumentToolInputSchema = z.object({
  documentId: z.string().min(1),
  query: z.string().min(1),
  scope: z.array(z.string().min(1)).optional(),
  fields: z
    .array(z.enum(["module", "caseTitle", "precondition", "operation", "expected"]))
    .optional(),
  limit: z.number().int().min(1).max(100).optional(),
  cursor: z.string().min(1).optional(),
})
export const ReadDocumentToolInputSchema = z.object({
  documentId: z.string().min(1),
  view: z.enum([DOCUMENT_READ_VIEW.OUTLINE, DOCUMENT_READ_VIEW.SUBTREE]),
  path: z.array(z.string().min(1)).optional(),
  maxLines: z.number().int().min(1).max(1_000).optional(),
})
export const EditDocumentToolInputSchema = z.object({
  documentId: z.string().min(1),
  anchorTag: z.string().min(1),
  patch: z.string().min(1),
  preview: z.boolean().optional(),
  confirmationToken: z.string().min(1).optional(),
})

export function isDocumentPortalTool(toolName: string): toolName is DocumentPortalToolName {
  return Object.values(DOCUMENT_PORTAL_TOOL_NAME).includes(toolName as DocumentPortalToolName)
}

export function executeDocumentPortalTool(
  toolName: DocumentPortalToolName,
  input: unknown,
  portal: DocumentPortal = mindMapDocumentPortal
): Record<string, unknown> | Promise<Record<string, unknown>> {
  try {
    if (toolName === DOCUMENT_PORTAL_TOOL_NAME.DOCUMENTS) {
      DocumentsToolInputSchema.parse(input)
      return { success: true, documents: portal.listDocuments() }
    }
    if (toolName === DOCUMENT_PORTAL_TOOL_NAME.SEARCH) {
      return { success: true, ...portal.search(SearchDocumentToolInputSchema.parse(input)) }
    }
    if (toolName === DOCUMENT_PORTAL_TOOL_NAME.EDIT) {
      return portal.edit(EditDocumentToolInputSchema.parse(input)).then(
        result => ({ success: true, ...result }),
        error => {
          if (error instanceof DocumentPortalError)
            return { success: false, error: error.message, errorCode: error.code }
          throw error
        }
      )
    }
    return { success: true, ...portal.read(ReadDocumentToolInputSchema.parse(input)) }
  } catch (error) {
    if (error instanceof DocumentPortalError) {
      return { success: false, error: error.message, errorCode: error.code }
    }
    throw error
  }
}
