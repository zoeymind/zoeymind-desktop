#!/usr/bin/env node
import {
  requestDocumentPortal,
  type DocumentPortalTool,
} from "@zoeymind-desktop/document-portal-client/node";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  createDocumentPortalServer,
  type DocumentPortalResponse,
} from "./server.js";
import { formatDoctorReport, runDoctor } from "./doctor.js";

const client = {
  async request(
    tool: DocumentPortalTool,
    input: unknown,
  ): Promise<DocumentPortalResponse> {
    try {
      return (await requestDocumentPortal(
        tool,
        input,
      )) as DocumentPortalResponse;
    } catch (error) {
      return {
        success: false,
        errorCode: "APP_UNAVAILABLE",
        error:
          error instanceof Error
            ? error.message
            : "ZoeyMind Document Portal is unavailable.",
      };
    }
  },
};

async function serve(): Promise<void> {
  const server = createDocumentPortalServer(client);
  const transport = new StdioServerTransport();

  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.once(signal, () => {
      void server.close().finally(() => process.exit(0));
    });
  }

  await server.connect(transport);
}

async function main(): Promise<void> {
  if (process.argv[2] === "doctor") {
    const report = await runDoctor();
    process.stdout.write(
      process.argv.includes("--json")
        ? `${JSON.stringify(report)}\n`
        : `${formatDoctorReport(report)}\n`,
    );
    if (!report.ok) process.exitCode = 1;
    return;
  }
  await serve();
}

void main().catch((error) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : "ZoeyMind MCP server failed to start"}\n`,
  );
  process.exitCode = 1;
});
