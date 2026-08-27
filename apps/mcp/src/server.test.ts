import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { describe, expect, it } from "vitest";
import {
  createDocumentPortalServer,
  type DocumentPortalClient,
} from "./server.js";

function fakeClient(): DocumentPortalClient & {
  calls: Array<{ tool: string; input: unknown }>;
} {
  const calls: Array<{ tool: string; input: unknown }> = [];
  return {
    calls,
    async request(tool, input) {
      calls.push({ tool, input });
      return { success: true };
    },
  };
}

async function connect(client: DocumentPortalClient) {
  const server = createDocumentPortalServer(client);
  const [serverTransport, clientTransport] =
    InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  const session = new Client({ name: "test", version: "1" });
  await session.connect(clientTransport);
  return { server, session };
}

describe("ZoeyMind MCP external project interface", () => {
  it("exposes project control plus current-mind-map query and edit", async () => {
    const broker = fakeClient();
    const connection = await connect(broker);
    const listed = await connection.session.listTools();
    expect(listed.tools.map((tool) => tool.name)).toEqual([
      "projects",
      "activate_project",
      "query_current_mindmap",
      "edit_current_mindmap",
    ]);
    expect(
      listed.tools.find((tool) => tool.name === "query_current_mindmap")
        ?.inputSchema,
    ).not.toHaveProperty("properties.documentId");
    expect(
      listed.tools.find((tool) => tool.name === "projects")?.inputSchema,
    ).toMatchObject({
      type: "object",
      properties: {
        action: { enum: ["list", "create"] },
        projectId: {
          type: "string",
          description: "For list: return only this exact projectId.",
        },
        title: { type: "string" },
      },
    });
    expect(
      listed.tools.find((tool) => tool.name === "query_current_mindmap")
        ?.inputSchema,
    ).toMatchObject({
      type: "object",
      properties: {
        mode: { enum: ["outline", "subtree", "search"] },
        path: {
          type: "array",
          description: "For outline/subtree: root-relative read path.",
        },
        maxLines: { type: "integer", maximum: 1000 },
        query: { type: "string", description: "Required for search." },
        scope: { type: "array" },
        fields: { type: "array" },
        limit: { type: "integer" },
        cursor: { type: "string" },
      },
    });
    expect(
      listed.tools.find((tool) => tool.name === "edit_current_mindmap")
        ?.inputSchema,
    ).toMatchObject({
      type: "object",
      properties: {
        anchorTag: { type: "string" },
        operations: { type: "array", minItems: 1 },
        patch: { type: "string" },
      },
    });

    await connection.session.callTool({
      name: "projects",
      arguments: { action: "list" },
    });
    await connection.session.callTool({
      name: "activate_project",
      arguments: { projectId: "a" },
    });
    await connection.session.callTool({
      name: "query_current_mindmap",
      arguments: { mode: "outline" },
    });
    await connection.session.callTool({
      name: "edit_current_mindmap",
      arguments: { anchorTag: "A001", patch: "PUT 1.=1:\n+Done" },
    });
    await connection.session.callTool({
      name: "edit_current_mindmap",
      arguments: {
        anchorTag: "A002",
        operations: [{ op: "delete", at: 3 }],
      },
    });

    expect(broker.calls).toEqual([
      { tool: "projects", input: { action: "list" } },
      { tool: "activate_project", input: { projectId: "a" } },
      { tool: "query_current_mindmap", input: { mode: "outline" } },
      {
        tool: "edit_current_mindmap",
        input: { anchorTag: "A001", patch: "PUT 1.=1:\n+Done" },
      },
      {
        tool: "edit_current_mindmap",
        input: { anchorTag: "A002", operations: [{ op: "delete", at: 3 }] },
      },
    ]);
    await connection.session.close();
    await connection.server.close();
  });

  it("rejects only requests that cannot execute and tolerates extra Agent context", async () => {
    const broker = fakeClient();
    const connection = await connect(broker);
    const invalidRequests = [
      { name: "projects", arguments: { action: "delete" } },
      { name: "activate_project", arguments: { projectId: "" } },
      {
        name: "query_current_mindmap",
        arguments: { mode: "search", query: "" },
      },
      {
        name: "query_current_mindmap",
        arguments: { mode: "search" },
      },
      { name: "edit_current_mindmap", arguments: { anchorTag: "", patch: "" } },
    ];
    for (const request of invalidRequests) {
      const rejected = await connection.session.callTool(request);
      expect(rejected.isError).toBe(true);
      expect(JSON.stringify(rejected.content)).toMatch(
        /Input validation error/,
      );
    }
    expect(broker.calls).toEqual([]);

    for (const request of [
      {
        name: "projects",
        arguments: { action: "create", projectId: "ignored", title: "Draft" },
      },
      {
        name: "query_current_mindmap",
        arguments: { mode: "outline", query: "ignored", extra: true },
      },
      {
        name: "query_current_mindmap",
        arguments: { mode: "search", query: "case", path: ["ignored"] },
      },
      {
        name: "edit_current_mindmap",
        arguments: { anchorTag: "A", patch: "PUT 1.=1:\n+Done", extra: true },
      },
    ])
      expect((await connection.session.callTool(request)).isError).not.toBe(
        true,
      );
    expect(broker.calls).toEqual([
      {
        tool: "projects",
        input: { action: "create", projectId: "ignored", title: "Draft" },
      },
      {
        tool: "query_current_mindmap",
        input: { mode: "outline", query: "ignored" },
      },
      {
        tool: "query_current_mindmap",
        input: { mode: "search", query: "case", path: ["ignored"] },
      },
      {
        tool: "edit_current_mindmap",
        input: { anchorTag: "A", patch: "PUT 1.=1:\n+Done" },
      },
    ]);

    await connection.session.close();
    await connection.server.close();
  });

  it("maps broker failures to MCP errors", async () => {
    const connection = await connect({
      async request() {
        return {
          success: false,
          errorCode: "DOCUMENT_NOT_READY",
          error: "Still opening",
        };
      },
    });
    const result = await connection.session.callTool({
      name: "query_current_mindmap",
      arguments: { mode: "outline" },
    });
    expect(result.isError).toBe(true);
    expect(result.structuredContent).toEqual({
      success: false,
      errorCode: "DOCUMENT_NOT_READY",
      error: "Still opening",
    });
    await connection.session.close();
    await connection.server.close();
  });
});
