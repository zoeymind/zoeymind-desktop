#!/usr/bin/env node
import { requestDocumentPortal, type DocumentPortalTool } from "@zoeymind-desktop/document-portal-client/node"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { createDocumentPortalServer, type DocumentPortalResponse } from "./server.js"

const client = {
  async request(tool: DocumentPortalTool, input: unknown): Promise<DocumentPortalResponse> {
    try {
      return await requestDocumentPortal(tool, input) as DocumentPortalResponse
    } catch (error) {
      return {
        success: false,
        errorCode: "APP_UNAVAILABLE",
        error: error instanceof Error ? error.message : "ZoeyMind Document Portal is unavailable.",
      }
    }
  },
}

const server = createDocumentPortalServer(client)
const transport = new StdioServerTransport()

async function close(): Promise<void> {
  await server.close()
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    void close().finally(() => process.exit(0))
  })
}

void server.connect(transport).catch(error => {
  process.stderr.write(`${error instanceof Error ? error.message : "ZoeyMind MCP server failed to start"}\n`)
  process.exitCode = 1
})
