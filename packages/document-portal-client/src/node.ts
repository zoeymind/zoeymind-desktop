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
  "ZoeyMind external automation is unavailable. Open Desktop, enable External automation in Preferences, and wait until it is ready.";

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
        body: JSON.stringify({ tool, input }),
      },
    );
  } catch {
    throw new Error(
      "ZoeyMind Document Portal is unavailable. The desktop app may have closed; reopen it and retry.",
    );
  }
  return response.json();
}

export const __test__ = { isValidDocumentPortalDescriptor, descriptorPath };
