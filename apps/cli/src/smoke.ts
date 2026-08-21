import { createServer } from "node:http"
import { requestDocumentPortal } from "./index.js"

const received: Array<{ tool: string; input: unknown }> = []
const server = createServer((request, response) => {
  let body = ""
  request.on("data", chunk => { body += String(chunk) })
  request.on("end", () => {
    received.push(JSON.parse(body) as { tool: string; input: unknown })
    response.setHeader("content-type", "application/json")
    response.end(JSON.stringify({ success: true }))
  })
})

await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve))
const address = server.address()
if (!address || typeof address === "string") throw new Error("Smoke broker did not bind")
const descriptor = async () => ({ version: 1 as const, pid: process.pid, port: address.port, token: "smoke-token" })
await requestDocumentPortal("documents", {}, descriptor)
await requestDocumentPortal("search", { documentId: "smoke", query: "case" }, descriptor)
await requestDocumentPortal("read", { documentId: "smoke", view: "outline" }, descriptor)
await requestDocumentPortal("edit", { documentId: "smoke", anchorTag: "anchor", patch: "PUT 1.=1:\n+next" }, descriptor)
await new Promise<void>(resolve => server.close(() => resolve()))
if (received.map(item => item.tool).join(",") !== "documents,search,read,edit") throw new Error("CLI smoke request shape mismatch")
process.stdout.write("documents → search → read → edit forwarded through fake broker\n")
