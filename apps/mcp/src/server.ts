import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod/v4";

const PACKAGE_VERSION = "0.3.1";

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
  title: z.string().min(1).optional(),
});
const activateInput = z.object({ projectId: z.string().min(1) });
const queryInput = z
  .object({
    mode: z.enum(["outline", "subtree", "search"]),
    path: z.array(z.string().min(1)).optional(),
    maxLines: z.number().int().min(1).max(1_000).optional(),
    query: z.string().min(1).optional(),
    scope: z.array(z.string().min(1)).optional(),
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
      .optional(),
    limit: z.number().int().min(1).max(100).optional(),
    cursor: z.string().min(1).optional(),
  })
  .superRefine((input, context) => {
    if (input.mode === "search" && input.query === undefined) {
      context.addIssue({
        code: "custom",
        message: "query is required when mode is search",
        path: ["query"],
      });
    }
  });
const editInput = z.object({
  anchorTag: z.string().min(1),
  patch: z.string().min(1),
  preview: z.boolean().optional(),
  returnView: z
    .object({
      view: z.enum(["outline", "subtree"]).optional(),
      maxLines: z.number().int().min(1).max(1_000).optional(),
    })
    .optional(),
});

function result(response: DocumentPortalResponse) {
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
      description: "List all ZoeyMind projects or create a draft project.",
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
        "Outline, search, or read a subtree from the currently active mind map.",
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
        "Apply an anchored Tree Hashline patch to the currently active mind map.",
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
