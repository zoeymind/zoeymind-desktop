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

    expect(broker.calls).toEqual([
      { tool: "projects", input: { action: "list" } },
      { tool: "activate_project", input: { projectId: "a" } },
      { tool: "query_current_mindmap", input: { mode: "outline" } },
      {
        tool: "edit_current_mindmap",
        input: { anchorTag: "A001", patch: "PUT 1.=1:\n+Done" },
      },
    ]);
    await connection.session.close();
    await connection.server.close();
  });

  it("keeps all public tool schemas strict at the adapter boundary", async () => {
    const broker = fakeClient();
    const connection = await connect(broker);
    const invalidRequests = [
      { name: "projects", arguments: { action: "delete" } },
      { name: "activate_project", arguments: { projectId: "" } },
      {
        name: "query_current_mindmap",
        arguments: { mode: "search", query: "" },
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
