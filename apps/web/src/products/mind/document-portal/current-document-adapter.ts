import { z } from "zod"
import {
  PROJECT_SESSION_LIFECYCLE,
  projectSessionRegistry,
  type ProjectSessionRegistry,
} from "../editor-session"
import { DocumentPortalError, type DocumentPortal } from "./document-portal"
import { mindMapDocumentPortal } from "./mindmap-document-portal"

export const CURRENT_DOCUMENT_PORTAL_TOOL_NAME = {
  SEARCH: "search",
  READ: "read",
  EDIT: "edit",
} as const

export type CurrentDocumentPortalToolName =
  (typeof CURRENT_DOCUMENT_PORTAL_TOOL_NAME)[keyof typeof CURRENT_DOCUMENT_PORTAL_TOOL_NAME]

export const CurrentDocumentSearchToolInputSchema = z
  .object({
    query: z.string().min(1),
    scope: z.array(z.string().min(1)).optional(),
    fields: z
      .array(z.enum(["module", "caseTitle", "precondition", "operation", "expected"]))
      .optional(),
    limit: z.number().int().min(1).max(100).optional(),
    cursor: z.string().min(1).optional(),
  })
  .strict()

export const CurrentDocumentReadToolInputSchema = z
  .object({
    view: z.enum(["outline", "subtree"]),
    path: z.array(z.string().min(1)).optional(),
    maxLines: z.number().int().min(1).max(1_000).optional(),
  })
  .strict()

export const CurrentDocumentEditToolInputSchema = z
  .object({
    anchorTag: z.string().min(1),
    patch: z.string().min(1),
    preview: z.boolean().optional(),
    confirmationToken: z.string().min(1).optional(),
  })
  .strict()

export interface CurrentDocumentResolver {
  resolve: () => string
}

interface CurrentDocumentPortalDependencies {
  portal?: DocumentPortal
  registry?: ProjectSessionRegistry
  resolver?: CurrentDocumentResolver
}

export function createCurrentDocumentResolver(
  registry: ProjectSessionRegistry = projectSessionRegistry
): CurrentDocumentResolver {
  return {
    resolve() {
      const session = registry.getActive()
      if (!session) {
        throw new DocumentPortalError("DOCUMENT_NOT_OPEN", "No active document is open")
      }

      const state = session.getState()
      if (state.lifecycle !== PROJECT_SESSION_LIFECYCLE.READY) {
        throw new DocumentPortalError(
          "DOCUMENT_NOT_READY",
          `Document is not ready: ${state.projectId}`
        )
      }

      return state.projectId
    },
  }
}
export function readCurrentDocumentOutline(
  dependencies: CurrentDocumentPortalDependencies = {}
): ReturnType<DocumentPortal["read"]> {
  const portal = dependencies.portal ?? mindMapDocumentPortal
  const resolver = dependencies.resolver ?? createCurrentDocumentResolver(dependencies.registry)
  return portal.read({
    documentId: resolver.resolve(),
    view: "outline",
    maxLines: 200,
  })
}

export function isCurrentDocumentPortalTool(
  toolName: string
): toolName is CurrentDocumentPortalToolName {
  return Object.values(CURRENT_DOCUMENT_PORTAL_TOOL_NAME).includes(
    toolName as CurrentDocumentPortalToolName
  )
}

export function executeCurrentDocumentPortalTool(
  toolName: CurrentDocumentPortalToolName,
  input: unknown,
  dependencies: CurrentDocumentPortalDependencies = {}
): Record<string, unknown> | Promise<Record<string, unknown>> {
  const portal = dependencies.portal ?? mindMapDocumentPortal
  const resolver = dependencies.resolver ?? createCurrentDocumentResolver(dependencies.registry)

  try {
    const documentId = resolver.resolve()
    if (toolName === CURRENT_DOCUMENT_PORTAL_TOOL_NAME.SEARCH) {
      return {
        success: true,
        ...portal.search({ ...CurrentDocumentSearchToolInputSchema.parse(input), documentId }),
      }
    }
    if (toolName === CURRENT_DOCUMENT_PORTAL_TOOL_NAME.EDIT) {
      return portal.edit({ ...CurrentDocumentEditToolInputSchema.parse(input), documentId }).then(
        result => ({ success: true, ...result }),
        error => {
          if (error instanceof DocumentPortalError)
            return { success: false, error: error.message, errorCode: error.code }
          throw error
        }
      )
    }
    return {
      success: true,
      ...portal.read({ ...CurrentDocumentReadToolInputSchema.parse(input), documentId }),
    }
  } catch (error) {
    if (error instanceof DocumentPortalError) {
      return { success: false, error: error.message, errorCode: error.code }
    }
    throw error
  }
}
