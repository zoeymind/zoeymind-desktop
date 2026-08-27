import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

export const EXPECTED_TOOLS = [
  "projects",
  "activate_project",
  "query_current_mindmap",
  "edit_current_mindmap",
] as const;

export type DoctorStatus = "pass" | "warn" | "fail";
export type DoctorCheck = {
  id: string;
  status: DoctorStatus;
  message: string;
  details?: unknown;
};
export type DoctorReport = {
  ok: boolean;
  checks: DoctorCheck[];
};

type McpToolResult = {
  structuredContent?: unknown;
  isError?: boolean;
};
export interface DoctorClient {
  listTools(): Promise<{ tools: Array<{ name: string }> }>;
  callTool(request: {
    name: string;
    arguments: Record<string, unknown>;
  }): Promise<unknown>;
  close(): Promise<void>;
}

type PortalContent = Record<string, unknown> & {
  success?: boolean;
  errorCode?: string;
  error?: string;
};

function portalContent(result: unknown): {
  content: PortalContent;
  isError: boolean;
} {
  if (typeof result !== "object" || result === null)
    return { content: {}, isError: true };
  const toolResult = result as McpToolResult;
  return {
    content: (toolResult.structuredContent ?? {}) as PortalContent,
    isError: toolResult.isError === true,
  };
}

export async function inspectDoctorClient(
  client: DoctorClient,
  nodeVersion = process.versions.node,
): Promise<DoctorReport> {
  const checks: DoctorCheck[] = [];
  const major = Number(nodeVersion.split(".", 1)[0]);
  checks.push({
    id: "node",
    status: major >= 22 ? "pass" : "fail",
    message:
      major >= 22
        ? `Node.js ${nodeVersion} satisfies the >=22 requirement.`
        : `Node.js ${nodeVersion} is unsupported; install Node.js 22 or newer.`,
  });

  let listed: { tools: Array<{ name: string }> };
  try {
    try {
      listed = await client.listTools();
    } catch (error) {
      checks.push({
        id: "mcp-stdio",
        status: "fail",
        message:
          error instanceof Error ? error.message : "MCP tool discovery failed.",
      });
      return { ok: false, checks };
    }
    const names = listed.tools.map((tool) => tool.name);
    const missing = EXPECTED_TOOLS.filter((tool) => !names.includes(tool));
    checks.push({
      id: "mcp-stdio",
      status: missing.length === 0 ? "pass" : "fail",
      message:
        missing.length === 0
          ? "MCP stdio handshake succeeded and all ZoeyMind tools are available."
          : `MCP server is missing tools: ${missing.join(", ")}.`,
      details: { tools: names },
    });
    if (missing.length > 0) return { ok: false, checks };

    let projectsResult: unknown;
    try {
      projectsResult = await client.callTool({
        name: "projects",
        arguments: { action: "list" },
      });
    } catch (error) {
      checks.push({
        id: "desktop-broker",
        status: "fail",
        message:
          error instanceof Error
            ? error.message
            : "ZoeyMind Desktop automation is unavailable.",
      });
      return { ok: false, checks };
    }
    const projectsResultContent = portalContent(projectsResult);
    const projectsContent = projectsResultContent.content;
    if (projectsResultContent.isError || projectsContent.success !== true) {
      checks.push({
        id: "desktop-broker",
        status: "fail",
        message:
          projectsContent.error ??
          "ZoeyMind Desktop automation is unavailable. Start Desktop, enable External automation, and retry.",
        details: projectsContent,
      });
      return { ok: false, checks };
    }

    checks.push({
      id: "desktop-broker",
      status: "pass",
      message: "Authenticated Desktop Broker request succeeded.",
    });

    const projects = Array.isArray(projectsContent.projects)
      ? (projectsContent.projects as Array<Record<string, unknown>>)
      : [];
    const activeReady = projects.find(
      (project) => project.active === true && project.ready === true,
    );
    if (!activeReady) {
      checks.push({
        id: "active-document",
        status: "warn",
        message:
          "Desktop is reachable, but no active ready project is open. Open a project before asking an Agent to query or edit it.",
        details: { projectCount: projects.length },
      });
      return { ok: checks.every((check) => check.status !== "fail"), checks };
    }

    let outlineResult: unknown;
    try {
      outlineResult = await client.callTool({
        name: "query_current_mindmap",
        arguments: { mode: "outline", maxLines: 20 },
      });
    } catch (error) {
      checks.push({
        id: "active-document",
        status: "fail",
        message:
          error instanceof Error
            ? error.message
            : "The active project failed its read-only outline check.",
      });
      return { ok: false, checks };
    }
    const outline = portalContent(outlineResult);
    const outlineContent = outline.content;
    checks.push({
      id: "active-document",
      status:
        outline.isError || outlineContent.success !== true ? "fail" : "pass",
      message:
        outline.isError || outlineContent.success !== true
          ? (outlineContent.error ??
            "The active project failed its read-only outline check.")
          : "The active project passed a read-only outline query.",
      details:
        outline.isError || outlineContent.success !== true
          ? outlineContent
          : { projectId: activeReady.projectId, title: activeReady.title },
    });
  } finally {
    await client.close().catch(() => undefined);
  }

  return { ok: checks.every((check) => check.status !== "fail"), checks };
}

export async function runDoctor(): Promise<DoctorReport> {
  const script = process.argv[1];
  if (!script) {
    return {
      ok: false,
      checks: [
        {
          id: "mcp-stdio",
          status: "fail",
          message: "Cannot resolve the installed zoeymind-mcp executable.",
        },
      ],
    };
  }
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [script, "--stdio"],
    stderr: "pipe",
  });
  const client = new Client({ name: "zoeymind-doctor", version: "1" });
  const doctorClient: DoctorClient = {
    listTools: async () => await client.listTools(),
    callTool: async (request) => await client.callTool(request),
    close: async () => await client.close(),
  };
  try {
    await client.connect(transport);
  } catch (error) {
    await client.close().catch(() => undefined);
    return {
      ok: false,
      checks: [
        {
          id: "mcp-stdio",
          status: "fail",
          message:
            error instanceof Error
              ? error.message
              : "MCP stdio handshake failed.",
        },
      ],
    };
  }
  return await inspectDoctorClient(doctorClient);
}

export function formatDoctorReport(report: DoctorReport): string {
  return report.checks
    .map(
      (check) => `${check.status.toUpperCase()} ${check.id}: ${check.message}`,
    )
    .join("\n");
}
