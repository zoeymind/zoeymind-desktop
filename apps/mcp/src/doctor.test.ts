import { describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";

import {
  EXPECTED_TOOLS,
  inspectDoctorClient,
  type DoctorClient,
} from "./doctor.js";
interface TestDoctorClient extends DoctorClient {
  callTool: Mock<DoctorClient["callTool"]>;
}

function doctorClient(
  projects: Record<string, unknown>,
  outline: Record<string, unknown> = { success: true, content: "1: Root" },
): TestDoctorClient {
  const callTool = vi.fn(async ({ name }: { name: string }) => ({
    structuredContent: name === "projects" ? projects : outline,
    isError:
      (name === "projects" ? projects.success : outline.success) === false,
  }));
  return {
    listTools: async () => ({
      tools: EXPECTED_TOOLS.map((name) => ({ name })),
    }),
    callTool,
    close: vi.fn(async () => undefined),
  };
}

describe("ZoeyMind MCP doctor", () => {
  it("performs stdio discovery, Broker access, and an active-document read", async () => {
    const client = doctorClient({
      success: true,
      projects: [
        { projectId: "ready", title: "Ready", active: true, ready: true },
      ],
    });

    const report = await inspectDoctorClient(client, "22.12.0");

    expect(report.ok).toBe(true);
    expect(report.checks.map(({ id, status }) => [id, status])).toEqual([
      ["node", "pass"],
      ["mcp-stdio", "pass"],
      ["desktop-broker", "pass"],
      ["active-document", "pass"],
    ]);
    expect(client.callTool).toHaveBeenNthCalledWith(1, {
      name: "projects",
      arguments: { action: "list" },
    });
    expect(client.callTool).toHaveBeenNthCalledWith(2, {
      name: "query_current_mindmap",
      arguments: { mode: "outline", maxLines: 20 },
    });
  });

  it("warns without failing when Desktop has no active ready project", async () => {
    const report = await inspectDoctorClient(
      doctorClient({ success: true, projects: [] }),
      "22.12.0",
    );

    expect(report.ok).toBe(true);
    expect(report.checks.at(-1)).toMatchObject({
      id: "active-document",
      status: "warn",
    });
  });

  it("fails with the Broker repair message when Desktop automation is unavailable", async () => {
    const report = await inspectDoctorClient(
      doctorClient({
        success: false,
        errorCode: "APP_UNAVAILABLE",
        error: "Enable External automation in Desktop.",
      }),
      "22.12.0",
    );

    expect(report.ok).toBe(false);
    expect(report.checks.at(-1)).toMatchObject({
      id: "desktop-broker",
      status: "fail",
      message: "Enable External automation in Desktop.",
    });
  });

  it("keeps a structured stdio failure when tool discovery rejects", async () => {
    const client = doctorClient({ success: true, projects: [] });
    client.listTools = vi.fn(async () => {
      throw new Error("MCP transport closed during tool discovery.");
    });

    const report = await inspectDoctorClient(client, "22.12.0");

    expect(report).toEqual({
      ok: false,
      checks: [
        expect.objectContaining({ id: "node", status: "pass" }),
        expect.objectContaining({
          id: "mcp-stdio",
          status: "fail",
          message: "MCP transport closed during tool discovery.",
        }),
      ],
    });
  });

  it("preserves passed MCP and Broker checks when the outline call rejects", async () => {
    const client = doctorClient({
      success: true,
      projects: [
        { projectId: "ready", title: "Ready", active: true, ready: true },
      ],
    });
    client.callTool.mockImplementation(async ({ name }) => {
      if (name === "projects")
        return {
          structuredContent: {
            success: true,
            projects: [
              { projectId: "ready", title: "Ready", active: true, ready: true },
            ],
          },
        };
      throw new Error("Desktop restarted during the outline query.");
    });

    const report = await inspectDoctorClient(client, "22.12.0");

    expect(report.ok).toBe(false);
    expect(report.checks).toEqual([
      expect.objectContaining({ id: "node", status: "pass" }),
      expect.objectContaining({ id: "mcp-stdio", status: "pass" }),
      expect.objectContaining({ id: "desktop-broker", status: "pass" }),
      expect.objectContaining({
        id: "active-document",
        status: "fail",
        message: "Desktop restarted during the outline query.",
      }),
    ]);
  });
});
