import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js"
import { describe, expect, it } from "vitest"
import { createDocumentPortalServer, type DocumentPortalClient } from "./server.js"

const responses = {
  documents: { success: true, documents: [{ documentId: "a", title: "A", ready: true, dirty: false, active: true, revision: 1 }] },
  search: { success: true, documentId: "a", revision: 1, hits: [{ modulePath: ["Refund"], readPath: ["Refund"], field: "caseTitle" }], total: 1, returned: 1, truncated: false },
  read: { success: true, documentId: "a", title: "A", revision: 1, view: "subtree", content: "[A#C001]\n1:# Refund", lineCount: 1, truncated: false, anchorTag: "C001" },
  edit: { success: true, documentId: "a", revision: 2, dirty: true, preview: { destructive: true, removedNodes: 2, affectedNodes: [{ path: ["Refund"], type: "case", text: "Refund", depth: 0, count: 2 }], confirmationToken: "confirm-delete-refund" } },
} as const

function fakeClient(): DocumentPortalClient & { calls: Array<{ tool: string; input: unknown }> } {
  const calls: Array<{ tool: string; input: unknown }> = []
  return { calls, async request(tool, input) { calls.push({ tool, input }); return responses[tool] } }
}

async function connect(client: DocumentPortalClient) {
  const server = createDocumentPortalServer(client)
  const [serverTransport, clientTransport] = InMemoryTransport.createLinkedPair()
  await server.connect(serverTransport)
  const session = new Client({ name: "test", version: "1" })
  await session.connect(clientTransport)
  return { session, server, serverTransport, clientTransport }
}

describe("ZoeyMind Document Portal MCP", () => {
  it("lists exactly the four generic tools with their safety annotations", async () => {
    const connection = await connect(fakeClient())
    const listed = await connection.session.listTools()
    expect(listed.tools.map(tool => tool.name)).toEqual(["documents", "search", "read", "edit"])
    expect(listed.tools.map(tool => tool.annotations)).toEqual([
      { readOnlyHint: true }, { readOnlyHint: true }, { readOnlyHint: true },
      { readOnlyHint: false, destructiveHint: true, idempotentHint: false },
    ])
    expect(listed.tools.find(tool => tool.name === "search")?.inputSchema).toMatchObject({ properties: { documentId: {}, query: {} }, required: ["documentId", "query"] })
    expect(listed.tools.find(tool => tool.name === "edit")?.inputSchema).toMatchObject({ properties: { documentId: {}, anchorTag: {}, patch: {}, confirmationToken: {} }, required: ["documentId", "anchorTag", "patch"] })
    expect(listed.tools.find(tool => tool.name === "documents")?.outputSchema).toMatchObject({ properties: { success: {}, documents: {}, errorCode: {}, error: {} }, required: ["success"] })
    expect(listed.tools.find(tool => tool.name === "search")?.outputSchema).toMatchObject({ properties: { success: {}, hits: {}, truncated: {}, nextCursor: {}, errorCode: {}, error: {} }, required: ["success"] })
    expect(listed.tools.find(tool => tool.name === "read")?.outputSchema).toMatchObject({ properties: { success: {}, content: {}, anchorTag: {}, revision: {}, errorCode: {}, error: {} }, required: ["success"] })
    expect(listed.tools.find(tool => tool.name === "edit")?.outputSchema).toMatchObject({ properties: { success: {}, preview: {}, dirty: {}, errorCode: {}, error: {} }, required: ["success"] })
    await connection.session.close()
    await connection.server.close()
  })

  it("forwards each call through each independent MCP session without document state", async () => {
    const broker = fakeClient()
    for (const sessionNumber of [1, 2]) {
      const connection = await connect(broker)
      await connection.session.listTools()
      const result = await connection.session.callTool({ name: "documents", arguments: {} })
      expect(result.structuredContent).toEqual(responses.documents)
      await connection.session.callTool({ name: "search", arguments: { documentId: "a", query: "refund" } })
      await connection.session.callTool({ name: "read", arguments: { documentId: "a", view: "subtree" } })
      await connection.session.callTool({ name: "edit", arguments: { documentId: "a", anchorTag: "C001", patch: "PUT 1.=1:\n+# Done", confirmationToken: "confirm-delete-refund" } })
      await connection.session.close()
      await connection.server.close()
      expect(sessionNumber).toBeGreaterThan(0)
    }
    expect(broker.calls).toEqual([
      { tool: "documents", input: {} }, { tool: "search", input: { documentId: "a", query: "refund" } }, { tool: "read", input: { documentId: "a", view: "subtree" } }, { tool: "edit", input: { documentId: "a", anchorTag: "C001", patch: "PUT 1.=1:\n+# Done", confirmationToken: "confirm-delete-refund" } },
      { tool: "documents", input: {} }, { tool: "search", input: { documentId: "a", query: "refund" } }, { tool: "read", input: { documentId: "a", view: "subtree" } }, { tool: "edit", input: { documentId: "a", anchorTag: "C001", patch: "PUT 1.=1:\n+# Done", confirmationToken: "confirm-delete-refund" } },
    ])
  })

  it("returns broker failures as MCP tool errors while retaining errorCode", async () => {
    const connection = await connect({ async request() { return { success: false, errorCode: "ANCHOR_CONFLICT", error: "The anchor is stale" } } })
    await connection.session.listTools()
    const result = await connection.session.callTool({ name: "edit", arguments: { documentId: "a", anchorTag: "C001", patch: "PUT 1.=1:\n+# Done" } })
    expect(result.isError).toBe(true)
    expect(result.structuredContent).toEqual({ success: false, errorCode: "ANCHOR_CONFLICT", error: "The anchor is stale" })
    await connection.session.close()
    await connection.server.close()
  })
})
