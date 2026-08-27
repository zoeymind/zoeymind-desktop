import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { posix, win32 } from "node:path";
import type { DocumentPortalTool } from "./protocol.js";

export type { DocumentPortalTool } from "./protocol.js";

export const DOCUMENT_PORTAL_PROTOCOL_VERSION = 1 as const;
export type DocumentPortalDescriptor = {
  version: typeof DOCUMENT_PORTAL_PROTOCOL_VERSION;
  pid: number;
  port: number;
  token: string;
};
export type DocumentPortalDescriptorLoader =
  () => Promise<DocumentPortalDescriptor>;

export const DOCUMENT_PORTAL_UNAVAILABLE =
  "ZoeyMind Document Portal is unavailable. Open or reopen Desktop and wait until it is ready.";

export function isValidDocumentPortalDescriptor(
  descriptor: unknown,
): descriptor is DocumentPortalDescriptor {
  if (typeof descriptor !== "object" || descriptor === null) return false;
  const candidate = descriptor as Partial<DocumentPortalDescriptor>;
  const { pid, port, token } = candidate;
  return (
    candidate.version === DOCUMENT_PORTAL_PROTOCOL_VERSION &&
    typeof pid === "number" &&
    Number.isInteger(pid) &&
    pid > 0 &&
    typeof port === "number" &&
    Number.isInteger(port) &&
    port >= 1 &&
    port <= 65535 &&
    typeof token === "string" &&
    /^[0-9a-f]{64}$/.test(token)
  );
}

function descriptorPath(
  platform = process.platform,
  home = homedir(),
  environment: NodeJS.ProcessEnv = process.env,
): string {
  if (platform === "darwin")
    return posix.join(
      home,
      "Library",
      "Application Support",
      "com.zoeymind.desktop",
      "document-portal-broker.json",
    );
  if (platform === "win32")
    return win32.join(
      environment.LOCALAPPDATA ?? win32.join(home, "AppData", "Local"),
      "com.zoeymind.desktop",
      "document-portal-broker.json",
    );
  return posix.join(
    environment.XDG_DATA_HOME ?? posix.join(home, ".local", "share"),
    "com.zoeymind.desktop",
    "document-portal-broker.json",
  );
}

export async function loadDocumentPortalDescriptor(): Promise<DocumentPortalDescriptor> {
  try {
    const descriptor: unknown = JSON.parse(
      await readFile(descriptorPath(), "utf8"),
    );
    if (!isValidDocumentPortalDescriptor(descriptor))
      throw new Error("invalid");
    return descriptor;
  } catch {
    throw new Error(DOCUMENT_PORTAL_UNAVAILABLE);
  }
}
type PortalResponse = Record<string, unknown> & { success?: boolean };

function projectsBrokerInput(input: unknown): unknown {
  if (typeof input !== "object" || input === null) return input;
  const request = input as Record<string, unknown>;
  if (request.action === "list") return { action: "list" };
  if (request.action === "create")
    return {
      action: "create",
      ...(typeof request.title === "string" ? { title: request.title } : {}),
    };
  return input;
}

function queryBrokerInput(input: unknown): unknown {
  if (typeof input !== "object" || input === null) return input;
  const request = input as Record<string, unknown>;
  if (request.mode === "search")
    return {
      mode: "search",
      query: request.query,
      ...(Array.isArray(request.scope) ? { scope: request.scope } : {}),
      ...(Array.isArray(request.fields) ? { fields: request.fields } : {}),
      ...(typeof request.limit === "number" ? { limit: request.limit } : {}),
      ...(typeof request.cursor === "string" ? { cursor: request.cursor } : {}),
    };
  if (request.mode === "outline" || request.mode === "subtree")
    return {
      mode: request.mode,
      ...(Array.isArray(request.path) ? { path: request.path } : {}),
      ...(typeof request.maxLines === "number"
        ? { maxLines: request.maxLines }
        : {}),
    };
  return input;
}

function brokerInput(tool: DocumentPortalTool, input: unknown): unknown {
  if (tool === "projects") return projectsBrokerInput(input);
  if (tool === "query_current_mindmap") return queryBrokerInput(input);
  if (typeof input !== "object" || input === null) return input;
  const request = input as Record<string, unknown>;
  if (tool === "activate_project") return { projectId: request.projectId };
  if (tool === "edit_current_mindmap")
    return {
      anchorTag: request.anchorTag,
      ...(Array.isArray(request.operations)
        ? { operations: request.operations }
        : {}),
      ...(typeof request.patch === "string" ? { patch: request.patch } : {}),
      ...(typeof request.preview === "boolean"
        ? { preview: request.preview }
        : {}),
      ...(typeof request.returnView === "object" && request.returnView !== null
        ? {
            returnView: (() => {
              const returnView = request.returnView as Record<string, unknown>;
              return {
                ...(returnView.view === "outline" ||
                returnView.view === "subtree"
                  ? { view: returnView.view }
                  : {}),
                ...(Array.isArray(returnView.path)
                  ? { path: returnView.path }
                  : {}),
                ...(typeof returnView.maxLines === "number"
                  ? { maxLines: returnView.maxLines }
                  : {}),
              };
            })(),
          }
        : {}),
    };
  return input;
}

function filterProjects(
  response: PortalResponse,
  input: unknown,
): PortalResponse {
  if (
    response.success !== true ||
    !Array.isArray(response.projects) ||
    typeof input !== "object" ||
    input === null
  )
    return response;
  const filter = input as Record<string, unknown>;
  if (filter.action !== "list") return response;
  return {
    ...response,
    projects: response.projects.filter((project) => {
      if (typeof project !== "object" || project === null) return false;
      const candidate = project as Record<string, unknown>;
      return (
        (typeof filter.projectId !== "string" ||
          candidate.projectId === filter.projectId) &&
        (typeof filter.title !== "string" || candidate.title === filter.title)
      );
    }),
  };
}

function addOutlineSummary(response: PortalResponse): PortalResponse {
  if (
    response.success !== true ||
    response.truncated !== false ||
    typeof response.content !== "string"
  )
    return response;
  const priorityCounts = { P1: 0, P2: 0, P3: 0 };
  for (const match of response.content.matchAll(
    /^\d+:\s+\s*\[P([123])\]\s/gm,
  )) {
    const priority = `P${match[1]}` as keyof typeof priorityCounts;
    priorityCounts[priority] += 1;
  }
  return {
    ...response,
    summary: {
      caseCount: priorityCounts.P1 + priorityCounts.P2 + priorityCounts.P3,
      priorityCounts,
    },
  };
}

function shapePortalResponse(
  tool: DocumentPortalTool,
  input: unknown,
  response: unknown,
): unknown {
  if (typeof response !== "object" || response === null) return response;
  if (tool === "projects")
    return filterProjects(response as PortalResponse, input);
  if (
    tool === "query_current_mindmap" &&
    typeof input === "object" &&
    input !== null &&
    (input as Record<string, unknown>).mode === "outline"
  )
    return addOutlineSummary(response as PortalResponse);
  return response;
}

export async function requestDocumentPortal(
  tool: DocumentPortalTool,
  input: unknown,
  descriptor: DocumentPortalDescriptorLoader = loadDocumentPortalDescriptor,
): Promise<unknown> {
  const endpoint = await descriptor();
  let response: Response;
  try {
    response = await fetch(
      `http://127.0.0.1:${endpoint.port}/v1/document-portal`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${endpoint.token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ tool, input: brokerInput(tool, input) }),
      },
    );
  } catch {
    throw new Error(
      "ZoeyMind Document Portal is unavailable. The desktop app may have closed; reopen it and retry.",
    );
  }
  return shapePortalResponse(tool, input, await response.json());
}

export const __test__ = { isValidDocumentPortalDescriptor, descriptorPath };
