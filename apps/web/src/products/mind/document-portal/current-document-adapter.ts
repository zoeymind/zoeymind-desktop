import { z, ZodError } from "zod"
import {
  PROJECT_SESSION_LIFECYCLE,
  projectSessionRegistry,
  type ProjectSessionRegistry,
} from "../editor-session"
import { DocumentPortalError, type DocumentPortal } from "./document-portal"
import { mindMapDocumentPortal } from "./mindmap-document-portal"
import { useTabs, type TabId } from "@/shared/tabs/store"

export const CURRENT_DOCUMENT_PORTAL_TOOL_NAME = {
  QUERY: "query_current_mindmap",
  EDIT: "edit_current_mindmap",
} as const

export type CurrentDocumentPortalToolName =
  (typeof CURRENT_DOCUMENT_PORTAL_TOOL_NAME)[keyof typeof CURRENT_DOCUMENT_PORTAL_TOOL_NAME]

export const CurrentDocumentQueryToolInputSchema = z.discriminatedUnion("mode", [
  z
    .object({
      mode: z.enum(["outline", "subtree"]),
      path: z.array(z.string().min(1)).optional(),
      maxLines: z.number().int().min(1).max(1_000).optional(),
    })
    .strict(),
  z
    .object({
      mode: z.literal("search"),
      query: z.string().min(1),
      scope: z.array(z.string().min(1)).optional(),
      fields: z
        .array(z.enum(["module", "caseTitle", "precondition", "operation", "expected"]))
        .optional(),
      limit: z.number().int().min(1).max(100).optional(),
      cursor: z.string().min(1).optional(),
    })
    .strict(),
])

const positiveLine = z.number().int().positive()
const intentOperation = z.discriminatedUnion("op", [
  z.object({ op: z.literal("append_cases"), to: positiveLine, tree: z.string().min(1) }).strict(),
  z
    .object({
      op: z.literal("replace_text"),
      within: positiveLine,
      fields: z.array(z.enum(["caseTitle", "precondition", "operation", "expected"])).min(1),
      find: z.string().min(1),
      replace: z.string(),
      expect: z.number().int().nonnegative(),
    })
    .strict(),
  z.object({ op: z.literal("set_node"), at: positiveLine, value: z.string().min(1) }).strict(),
  z.object({ op: z.literal("delete"), at: positiveLine }).strict(),
  z
    .object({
      op: z.literal("move"),
      at: positiveLine,
      to: positiveLine,
      position: z.enum(["before", "after", "last-child"]),
    })
    .strict(),
])
const returnViewSchema = z
  .object({
    view: z.enum(["outline", "subtree"]).optional(),
    path: z
      .array(z.string().min(1))
      .optional()
      .describe("Preferred root-relative path for the fresh post-edit view."),
    maxLines: z.number().int().min(1).max(1_000).optional(),
  })
  .passthrough()

export const CurrentDocumentEditToolInputSchema = z.union([
  z
    .object({
      anchorTag: z.string().min(1),
      operations: z.array(intentOperation).min(1),
      preview: z.boolean().optional(),
      returnView: returnViewSchema.optional(),
    })
    .strict(),
  z
    .object({
      anchorTag: z.string().min(1),
      patch: z.string().min(1),
      preview: z.boolean().optional(),
      returnView: returnViewSchema.optional(),
    })
    .strict(),
])

export interface CurrentDocumentResolver {
  resolve: () => string
}
interface CurrentDocumentPortalDependencies {
  portal?: DocumentPortal
  registry?: ProjectSessionRegistry
  resolver?: CurrentDocumentResolver
  getActiveId?: () => TabId
}

export function createCurrentDocumentResolver(
  registry: ProjectSessionRegistry = projectSessionRegistry,
  getActiveId: () => TabId = () => useTabs.getState().activeId
): CurrentDocumentResolver {
  return {
    resolve() {
      const activeId = getActiveId()
      const session = activeId === "home" ? undefined : registry.get(activeId)
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
  const resolver =
    dependencies.resolver ??
    createCurrentDocumentResolver(dependencies.registry, dependencies.getActiveId)
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
  const resolver =
    dependencies.resolver ??
    createCurrentDocumentResolver(dependencies.registry, dependencies.getActiveId)

  try {
    const documentId = resolver.resolve()
    if (toolName === CURRENT_DOCUMENT_PORTAL_TOOL_NAME.QUERY) {
      const query = CurrentDocumentQueryToolInputSchema.parse(input)
      if (query.mode === "search") {
        return {
          success: true,
          ...portal.search({
            query: query.query,
            scope: query.scope,
            fields: query.fields,
            limit: query.limit,
            cursor: query.cursor,
            documentId,
          }),
        }
      }
      const { mode, ...request } = query
      return { success: true, ...portal.read({ ...request, view: mode, documentId }) }
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
    throw new DocumentPortalError("INVALID_REQUEST", `Unknown current mind map tool: ${toolName}`)
  } catch (error) {
    if (error instanceof DocumentPortalError) {
      return { success: false, error: error.message, errorCode: error.code }
    }
    if (error instanceof ZodError) {
      return { success: false, error: error.message, errorCode: "INVALID_REQUEST" }
    }
    throw error
  }
}

export function approveCurrentDocumentEdit(
  confirmationToken: string,
  returnView: { view?: "outline" | "subtree"; path?: string[]; maxLines?: number } | undefined,
  dependencies: CurrentDocumentPortalDependencies = {}
): ReturnType<DocumentPortal["edit"]> {
  const portal = dependencies.portal ?? mindMapDocumentPortal
  const resolver =
    dependencies.resolver ??
    createCurrentDocumentResolver(dependencies.registry, dependencies.getActiveId)
  return portal.edit({
    documentId: resolver.resolve(),
    confirmationToken,
    returnView,
  })
}
