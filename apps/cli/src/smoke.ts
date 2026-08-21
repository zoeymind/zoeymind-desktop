import { createServer } from "node:http";
import { requestDocumentPortal } from "./index.js";

const received: Array<{ tool: string; input: unknown }> = [];
const server = createServer((request, response) => {
  let body = "";
  request.on("data", (chunk) => {
    body += String(chunk);
  });
  request.on("end", () => {
    received.push(JSON.parse(body) as { tool: string; input: unknown });
    response.setHeader("content-type", "application/json");
    response.end(JSON.stringify({ success: true }));
  });
});

await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
if (!address || typeof address === "string")
  throw new Error("Smoke broker did not bind");
const descriptor = async () => ({
  version: 1 as const,
  pid: process.pid,
  port: address.port,
  token: "smoke-token",
});
await requestDocumentPortal("projects", { action: "list" }, descriptor);
await requestDocumentPortal(
  "activate_project",
  { projectId: "smoke" },
  descriptor,
);
await requestDocumentPortal(
  "query_current_mindmap",
  { mode: "outline" },
  descriptor,
);
await requestDocumentPortal(
  "edit_current_mindmap",
  { anchorTag: "anchor", patch: "PUT 1.=1:\n+next" },
  descriptor,
);
await new Promise<void>((resolve) => server.close(() => resolve()));
if (
  received.map((item) => item.tool).join(",") !==
  "projects,activate_project,query_current_mindmap,edit_current_mindmap"
)
  throw new Error("CLI smoke request shape mismatch");
process.stdout.write(
  "projects → activate → query → edit forwarded through fake broker\n",
);
