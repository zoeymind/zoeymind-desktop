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
void server.connect(new StdioServerTransport()).catch(error => {
  process.stderr.write(`${error instanceof Error ? error.message : "ZoeyMind MCP server failed to start"}\n`)
  process.exitCode = 1
})
