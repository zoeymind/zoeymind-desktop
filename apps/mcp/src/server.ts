import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod/v4"

export type DocumentPortalTool = "documents" | "search" | "read" | "edit"
export type DocumentPortalResponse = Record<string, unknown> & { success: boolean; errorCode?: string; error?: string }
export interface DocumentPortalClient {
  request(tool: DocumentPortalTool, input: unknown): Promise<DocumentPortalResponse>
}

const errorResponseSchema = z.object({
  success: z.literal(false),
  errorCode: z.string().min(1),
  error: z.string().min(1),
})
const documentSummarySchema = z.object({
  documentId: z.string().min(1),
  title: z.string(),
  active: z.boolean(),
  revision: z.number().int().nonnegative(),
  ready: z.boolean(),
  dirty: z.boolean(),
})
const documentsSuccessSchema = z.object({ success: z.literal(true), documents: z.array(documentSummarySchema) })
const searchHitSchema = z.object({
  modulePath: z.array(z.string()),
  readPath: z.array(z.string()),
  field: z.enum(["module", "caseTitle", "precondition", "operation", "expected"]),
})
const searchSuccessSchema = z.object({
  success: z.literal(true),
  documentId: z.string().min(1),
  revision: z.number().int().nonnegative(),
  hits: z.array(searchHitSchema),
  total: z.number().int().nonnegative(),
  returned: z.number().int().nonnegative(),
  nextCursor: z.string().min(1).optional(),
  truncated: z.boolean(),
})
const readSuccessSchema = z.object({
  success: z.literal(true),
  documentId: z.string().min(1),
  title: z.string(),
  revision: z.number().int().nonnegative(),
  view: z.enum(["outline", "subtree"]),
  path: z.array(z.string().min(1)).optional(),
  content: z.string(),
  lineCount: z.number().int().nonnegative(),
  truncated: z.boolean(),
  anchorTag: z.string().min(1),
})
const editPreviewSchema = z.object({
  destructive: z.boolean(),
  removedNodes: z.number().int().nonnegative(),
  affectedNodes: z.array(z.object({
    path: z.array(z.string().min(1)),
    type: z.enum(["module", "case", "step"]),
    text: z.string(),
    depth: z.number().int().nonnegative(),
    count: z.number().int().positive(),
  })),
  confirmationToken: z.string().min(1).optional(),
})
const editSuccessSchema = z.object({
  success: z.literal(true),
  documentId: z.string().min(1),
  revision: z.number().int().nonnegative(),
  dirty: z.boolean(),
  preview: editPreviewSchema.optional(),
})
export const documentsResponseSchema = z.discriminatedUnion("success", [documentsSuccessSchema, errorResponseSchema])
export const searchResponseSchema = z.discriminatedUnion("success", [searchSuccessSchema, errorResponseSchema])
export const readResponseSchema = z.discriminatedUnion("success", [readSuccessSchema, errorResponseSchema])
export const editResponseSchema = z.discriminatedUnion("success", [editSuccessSchema, errorResponseSchema])

// MCP SDK 1.x requires output schemas to be root objects. These explicit
// object views document both response branches while the discriminated unions
// above validate the actual broker response before it is exposed.
const documentsOutputSchema = z.object({ success: z.boolean(), documents: z.array(documentSummarySchema).optional(), errorCode: z.string().min(1).optional(), error: z.string().min(1).optional() })
const searchOutputSchema = z.object({ success: z.boolean(), documentId: z.string().min(1).optional(), revision: z.number().int().nonnegative().optional(), hits: z.array(searchHitSchema).optional(), total: z.number().int().nonnegative().optional(), returned: z.number().int().nonnegative().optional(), nextCursor: z.string().min(1).optional(), truncated: z.boolean().optional(), errorCode: z.string().min(1).optional(), error: z.string().min(1).optional() })
const readOutputSchema = z.object({ success: z.boolean(), documentId: z.string().min(1).optional(), title: z.string().optional(), revision: z.number().int().nonnegative().optional(), view: z.enum(["outline", "subtree"]).optional(), path: z.array(z.string().min(1)).optional(), content: z.string().optional(), lineCount: z.number().int().nonnegative().optional(), truncated: z.boolean().optional(), anchorTag: z.string().min(1).optional(), errorCode: z.string().min(1).optional(), error: z.string().min(1).optional() })
const editOutputSchema = z.object({ success: z.boolean(), documentId: z.string().min(1).optional(), revision: z.number().int().nonnegative().optional(), dirty: z.boolean().optional(), preview: editPreviewSchema.optional(), errorCode: z.string().min(1).optional(), error: z.string().min(1).optional() })
const documentsInput = z.object({})
const searchInput = z.object({
  documentId: z.string().min(1),
  query: z.string().min(1),
  scope: z.array(z.string().min(1)).optional(),
  fields: z.array(z.enum(["module", "caseTitle", "precondition", "operation", "expected"])).optional(),
  limit: z.number().int().min(1).max(100).optional(),
  cursor: z.string().min(1).optional(),
})
const readInput = z.object({
  documentId: z.string().min(1),
  view: z.enum(["outline", "subtree"]),
  path: z.array(z.string().min(1)).optional(),
  maxLines: z.number().int().min(1).max(1_000).optional(),
})
const editInput = z.object({
  documentId: z.string().min(1),
  anchorTag: z.string().min(1),
  patch: z.string().min(1),
  preview: z.boolean().optional(),
  confirmationToken: z.string().min(1).optional(),
})
function textContent(result: DocumentPortalResponse): string {
  return result.success
    ? JSON.stringify(result)
    : `${result.errorCode ?? "PORTAL_FAILURE"}: ${result.error ?? "Document Portal request failed"}`
}
function result<T extends DocumentPortalResponse>(response: T, schema: z.ZodType<T>) {
  const structuredContent = response.success ? schema.parse(response) : errorResponseSchema.parse(response)
  return {
    content: [{ type: "text" as const, text: textContent(response) }],
    structuredContent,
    ...(response.success ? {} : { isError: true }),
  }
}

export function createDocumentPortalServer(client: DocumentPortalClient): McpServer {
  const server = new McpServer({ name: "zoeymind-document-portal", version: "0.0.0" })
  server.registerTool("documents", {
    title: "List ZoeyMind documents",
    description: "List the currently open ZoeyMind documents.",
    inputSchema: documentsInput,
    outputSchema: documentsOutputSchema,
    annotations: { readOnlyHint: true },
  }, async () => result(await client.request("documents", {}), documentsResponseSchema))
  server.registerTool("search", {
    title: "Search a ZoeyMind document",
    description: "Search one open ZoeyMind document by its explicit documentId.",
    inputSchema: searchInput,
    outputSchema: searchOutputSchema,
    annotations: { readOnlyHint: true },
  }, async input => result(await client.request("search", input), searchResponseSchema))
  server.registerTool("read", {
    title: "Read a ZoeyMind document",
    description: "Read an anchored local view of one open ZoeyMind document.",
    inputSchema: readInput,
    outputSchema: readOutputSchema,
    annotations: { readOnlyHint: true },
  }, async input => result(await client.request("read", input), readResponseSchema))
  server.registerTool("edit", {
    title: "Edit a ZoeyMind document",
    description: "Apply an anchored Tree Hashline Patch to one open ZoeyMind document.",
    inputSchema: editInput,
    outputSchema: editOutputSchema,
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false },
  }, async input => result(await client.request("edit", input), editResponseSchema))
  return server
}
