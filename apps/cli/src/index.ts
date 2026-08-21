#!/usr/bin/env node
import { requestDocumentPortal, type DocumentPortalTool } from "@zoeymind-desktop/document-portal-client/node"


export { requestDocumentPortal }

function parseInput(tool: DocumentPortalTool, args: string[]): unknown {
  if (tool === "documents") return {}
  if (args.length !== 1) throw new Error(`${tool} requires exactly one JSON request argument including documentId`)
  try {
    const input = JSON.parse(args[0]) as unknown
    if (typeof input !== "object" || input === null || !("documentId" in input)) throw new Error("missing documentId")
    return input
  } catch { throw new Error(`${tool} requires a JSON request argument including documentId`) }
}

async function main(): Promise<void> {
  const [tool, ...args] = process.argv.slice(2)
  if (tool !== "documents" && tool !== "search" && tool !== "read" && tool !== "edit") throw new Error("Usage: zoeymind-documents <documents|search|read|edit> [json]")
  process.stdout.write(`${JSON.stringify(await requestDocumentPortal(tool, parseInput(tool, args)))}\n`)
}

if (process.argv[1]?.endsWith("index.ts") || process.argv[1]?.endsWith("index.js")) void main().catch(error => { process.stderr.write(`${error instanceof Error ? error.message : "Document Portal request failed"}\n`); process.exitCode = 1 })
