import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod/v4";

const PACKAGE_VERSION = "0.5.0";

export type DocumentPortalTool =
  | "projects"
  | "activate_project"
  | "query_current_mindmap"
  | "edit_current_mindmap";
export type DocumentPortalResponse = Record<string, unknown> & {
  success: boolean;
  errorCode?: string;
  error?: string;
};
export interface DocumentPortalClient {
  request(
    tool: DocumentPortalTool,
    input: unknown,
  ): Promise<DocumentPortalResponse>;
}

const errorResponseSchema = z.object({
  success: z.literal(false),
  errorCode: z.string().min(1),
  error: z.string().min(1),
});
const genericSuccessSchema = z
  .object({ success: z.literal(true) })
  .passthrough();
const outputSchema = z
  .object({
    success: z.boolean(),
    errorCode: z.string().min(1).optional(),
    error: z.string().min(1).optional(),
  })
  .passthrough();
const projectsInput = z.object({
  action: z.enum(["list", "create"]),
  projectId: z
    .string()
    .min(1)
    .optional()
    .describe("For list: return only this exact projectId."),
  title: z
    .string()
    .min(1)
    .optional()
    .describe("For list: exact title filter. For create: draft title."),
});
const activateInput = z.object({ projectId: z.string().min(1) });
const maxLines = z
  .number()
  .int()
  .min(1)
  .max(1_000)
  .optional()
  .describe("Maximum returned lines; defaults to 200 and cannot exceed 1000.");
const publicPath = z
  .array(z.string().min(1))
  .optional()
  .describe(
    "Root-relative node text segments. The document root may be included or omitted. A search hit readPath can be reused unchanged for subtree.",
  );
const queryInput = z
  .object({
    mode: z.enum(["outline", "subtree", "search"]),
    path: publicPath.describe("For outline/subtree: root-relative read path."),
    maxLines,
    query: z.string().min(1).optional().describe("Required for search."),
    scope: publicPath.describe(
      "For search: optional root-relative module scope.",
    ),
    fields: z
      .array(
        z.enum([
          "module",
          "caseTitle",
          "precondition",
          "operation",
          "expected",
        ]),
      )
      .optional()
      .describe("For search: fields to match."),
    limit: z
      .number()
      .int()
      .min(1)
      .max(100)
      .optional()
      .describe("For search: maximum hits per page."),
    cursor: z
      .string()
      .min(1)
      .optional()
      .describe("For search: next page cursor."),
  })
  .superRefine((input, context) => {
    if (input.mode === "search" && input.query === undefined)
      context.addIssue({
        code: "custom",
        message: "query is required when mode is search",
        path: ["query"],
      });
  });
const positiveLine = z.number().int().positive();
const intentOperation = z.discriminatedUnion("op", [
  z.object({
    op: z.literal("append_cases"),
    to: positiveLine,
    tree: z.string().min(1),
  }),
  z.object({
    op: z.literal("replace_text"),
    within: positiveLine,
    fields: z
      .array(z.enum(["caseTitle", "precondition", "operation", "expected"]))
      .min(1),
    find: z.string().min(1),
    replace: z.string(),
    expect: z.number().int().nonnegative(),
  }),
  z.object({
    op: z.literal("set_node"),
    at: positiveLine,
    value: z.string().min(1),
  }),
  z.object({ op: z.literal("delete"), at: positiveLine }),
  z.object({
    op: z.literal("move"),
    at: positiveLine,
    to: positiveLine,
    position: z.enum(["before", "after", "last-child"]),
  }),
]);
const returnView = z
  .object({
    view: z.enum(["outline", "subtree"]).optional(),
    path: z
      .array(z.string().min(1))
      .optional()
      .describe("Preferred root-relative path for the fresh post-edit view."),
    maxLines: z.number().int().min(1).max(1_000).optional(),
  })
  .optional();
const editInput = z
  .object({
    anchorTag: z.string().min(1),
    operations: z.array(intentOperation).min(1).optional(),
    patch: z.string().min(1).optional(),
    preview: z.boolean().optional(),
    returnView,
  })
  .superRefine((input, context) => {
    if ((input.operations === undefined) === (input.patch === undefined))
      context.addIssue({
        code: "custom",
        message: "Provide exactly one of operations or patch",
      });
  });

function externalResponse(
  response: DocumentPortalResponse,
): DocumentPortalResponse {
  if (response.success !== true || !Array.isArray(response.effects))
    return response;
  const {
    changeSummary: _changeSummary,
    documentId: _documentId,
    dirty: _dirty,
    ...compact
  } = response;
  return compact as DocumentPortalResponse;
}

function result(rawResponse: DocumentPortalResponse) {
  const response = externalResponse(rawResponse);
  const structuredContent = response.success
    ? genericSuccessSchema.parse(response)
    : errorResponseSchema.parse(response);
  return {
    content: [
      {
        type: "text" as const,
        text: response.success
          ? JSON.stringify(response)
          : `${response.errorCode ?? "PORTAL_FAILURE"}: ${response.error ?? "Request failed"}`,
      },
    ],
    structuredContent,
    ...(response.success ? {} : { isError: true }),
  };
}

export function createDocumentPortalServer(
  client: DocumentPortalClient,
): McpServer {
  const server = new McpServer({
    name: "zoeymind",
    version: PACKAGE_VERSION,
  });
  server.registerTool(
    "projects",
    {
      title: "List or create ZoeyMind projects",
      description:
        "List ZoeyMind project status, optionally filtered by exact projectId or title, or create a draft project.",
      inputSchema: projectsInput,
      outputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
      },
    },
    async (input) => result(await client.request("projects", input)),
  );
  server.registerTool(
    "activate_project",
    {
      title: "Activate a ZoeyMind project",
      description: "Open or activate one project as the current mind map.",
      inputSchema: activateInput,
      outputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
      },
    },
    async (input) => result(await client.request("activate_project", input)),
  );
  server.registerTool(
    "query_current_mindmap",
    {
      title: "Query the current ZoeyMind mind map",
      description:
        "Use outline for structure and case counts, subtree for complete local content, or search to locate content. Paths are root-relative node text segments; reuse a search hit readPath unchanged for subtree.",
      inputSchema: queryInput,
      outputSchema,
      annotations: { readOnlyHint: true },
    },
    async (input) =>
      result(await client.request("query_current_mindmap", input)),
  );
  server.registerTool(
    "edit_current_mindmap",
    {
      title: "Edit the current ZoeyMind mind map",
      description:
        "Use operations for precise set/delete/move, scoped literal replacement, and appending generated test cases. Query first and use its latest anchorTag plus line numbers. operations and legacy Tree Hashline patch are mutually exclusive. Successful operations return a compact receipt unless returnView is requested.",
      inputSchema: editInput,
      outputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
      },
    },
    async (input) =>
      result(await client.request("edit_current_mindmap", input)),
  );
  return server;
}
