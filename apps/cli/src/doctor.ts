import {
  requestDocumentPortal,
  type DocumentPortalTool,
} from "@zoeymind-desktop/document-portal-client/node";

export type CliDoctorReport = {
  ok: boolean;
  checks: Array<{
    id: string;
    status: "pass" | "warn" | "fail";
    message: string;
    details?: unknown;
  }>;
};

type PortalResponse = Record<string, unknown> & {
  success?: boolean;
  errorCode?: string;
  error?: string;
};
export type PortalRequest = (
  tool: DocumentPortalTool,
  input: unknown,
) => Promise<unknown>;

export async function runCliDoctor(
  request: PortalRequest = requestDocumentPortal,
  nodeVersion = process.versions.node,
): Promise<CliDoctorReport> {
  const checks: CliDoctorReport["checks"] = [];
  const major = Number(nodeVersion.split(".", 1)[0]);
  checks.push({
    id: "node",
    status: major >= 22 ? "pass" : "fail",
    message:
      major >= 22
        ? `Node.js ${nodeVersion} satisfies the >=22 requirement.`
        : `Node.js ${nodeVersion} is unsupported; install Node.js 22 or newer.`,
  });

  let projectsContent: PortalResponse;
  try {
    projectsContent = (await request("projects", {
      action: "list",
    })) as PortalResponse;
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
  if (projectsContent.success !== true) {
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

  let outlineContent: PortalResponse;
  try {
    outlineContent = (await request("query_current_mindmap", {
      mode: "outline",
      maxLines: 20,
    })) as PortalResponse;
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
  checks.push({
    id: "active-document",
    status: outlineContent.success === true ? "pass" : "fail",
    message:
      outlineContent.success === true
        ? "The active project passed a read-only outline query."
        : (outlineContent.error ??
          "The active project failed its read-only outline check."),
    details:
      outlineContent.success === true
        ? { projectId: activeReady.projectId, title: activeReady.title }
        : outlineContent,
  });
  return { ok: checks.every((check) => check.status !== "fail"), checks };
}

export function formatCliDoctorReport(report: CliDoctorReport): string {
  return report.checks
    .map(
      (check) => `${check.status.toUpperCase()} ${check.id}: ${check.message}`,
    )
    .join("\n");
}
