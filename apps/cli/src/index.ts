#!/usr/bin/env node
import {
  requestDocumentPortal,
  type DocumentPortalTool,
} from "@zoeymind-desktop/document-portal-client/node";
import { formatCliDoctorReport, runCliDoctor } from "./doctor.js";

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

export async function main(args = process.argv.slice(2)): Promise<void> {
  const [tool, ...toolArgs] = args;
  if (tool === "doctor") {
    const report = await runCliDoctor();
    process.stdout.write(
      toolArgs.includes("--json")
        ? `${JSON.stringify(report)}\n`
        : `${formatCliDoctorReport(report)}\n`,
    );
    if (!report.ok) process.exitCode = 1;
    return;
  }
  if (tool === "--help" || tool === "-h") {
    process.stdout.write(
      "Usage: zoeymind <doctor|projects|activate_project|query_current_mindmap|edit_current_mindmap> [json]\n",
    );
    return;
  }
  if (
    tool !== "projects" &&
    tool !== "activate_project" &&
    tool !== "query_current_mindmap" &&
    tool !== "edit_current_mindmap"
  )
    throw new Error(
      "Usage: zoeymind <doctor|projects|activate_project|query_current_mindmap|edit_current_mindmap> [json]",
    );
  process.stdout.write(
    `${JSON.stringify(await requestDocumentPortal(tool, parseInput(tool, toolArgs)))}\n`,
  );
}
