import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js"
import { createDocumentPortalServer, type DocumentPortalClient } from "./server.js"

const broker: DocumentPortalClient = {
  async request(tool) {
    if (tool === "documents") return { success: true, documents: [] }
    throw new Error(`Unexpected smoke tool: ${tool}`)
  },
}
const server = createDocumentPortalServer(broker)
const [serverTransport, clientTransport] = InMemoryTransport.createLinkedPair()
await server.connect(serverTransport)
const client = new Client({ name: "smoke", version: "1" })
await client.connect(clientTransport)
const tools = await client.listTools()
if (tools.tools.map(tool => tool.name).join(",") !== "documents,search,read,edit") throw new Error("MCP tool discovery failed")
const result = await client.callTool({ name: "documents", arguments: {} })
if (result.isError || result.structuredContent === undefined) throw new Error("MCP tool call failed")
await client.close()
await server.close()
