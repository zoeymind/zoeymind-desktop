#!/usr/bin/env node
import {
  requestDocumentPortal,
  type DocumentPortalTool,
} from "@zoeymind-desktop/document-portal-client/node";

export { requestDocumentPortal };

function parseInput(tool: DocumentPortalTool, args: string[]): unknown {
  if (tool === "projects" && args.length === 0) return { action: "list" };
  if (args.length !== 1)
    throw new Error(`${tool} requires exactly one JSON request argument`);
  try {
    const input = JSON.parse(args[0]) as unknown;
    if (typeof input !== "object" || input === null)
      throw new Error("invalid input");
    return input;
  } catch {
    throw new Error(`${tool} requires a JSON request argument`);
  }
}

async function main(): Promise<void> {
  const [tool, ...args] = process.argv.slice(2);
  if (
    tool !== "projects" &&
    tool !== "activate_project" &&
    tool !== "query_current_mindmap" &&
    tool !== "edit_current_mindmap"
  )
    throw new Error(
      "Usage: zoeymind-documents <projects|activate_project|query_current_mindmap|edit_current_mindmap> [json]",
    );
  process.stdout.write(
    `${JSON.stringify(await requestDocumentPortal(tool, parseInput(tool, args)))}\n`,
  );
}

if (
  process.argv[1]?.endsWith("index.ts") ||
  process.argv[1]?.endsWith("index.js")
)
  void main().catch((error) => {
    process.stderr.write(
      `${error instanceof Error ? error.message : "Document Portal request failed"}\n`,
    );
    process.exitCode = 1;
  });
