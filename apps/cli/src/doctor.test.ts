import { describe, expect, it, vi } from "vitest";
import { runCliDoctor, type PortalRequest } from "./doctor.js";

describe("ZoeyMind CLI doctor", () => {
  it("checks Broker access and the active document without writing", async () => {
    const request = vi.fn<PortalRequest>(async (tool) =>
      tool === "projects"
        ? {
            success: true,
            projects: [
              { projectId: "ready", title: "Ready", active: true, ready: true },
            ],
          }
        : { success: true, content: "1: Root" },
    );

    const report = await runCliDoctor(request, "22.12.0");

    expect(report.ok).toBe(true);
    expect(report.checks.map(({ id, status }) => [id, status])).toEqual([
      ["node", "pass"],
      ["desktop-broker", "pass"],
      ["active-document", "pass"],
    ]);
    expect(request).toHaveBeenNthCalledWith(1, "projects", { action: "list" });
    expect(request).toHaveBeenNthCalledWith(2, "query_current_mindmap", {
      mode: "outline",
      maxLines: 20,
    });
  });

  it("warns when no project is active and ready", async () => {
    const report = await runCliDoctor(
      async () => ({ success: true, projects: [] }),
      "22.12.0",
    );

    expect(report.ok).toBe(true);
    expect(report.checks.at(-1)).toMatchObject({
      id: "active-document",
      status: "warn",
    });
  });

  it("fails with a repairable Desktop error", async () => {
    const report = await runCliDoctor(async () => {
      throw new Error("Enable External automation in Desktop.");
    }, "22.12.0");

    expect(report.ok).toBe(false);
    expect(report.checks.at(-1)).toMatchObject({
      id: "desktop-broker",
      status: "fail",
      message: "Enable External automation in Desktop.",
    });
  });

  it("keeps JSON checks when the active-document query throws", async () => {
    const request = vi.fn<PortalRequest>(async (tool) => {
      if (tool === "projects")
        return {
          success: true,
          projects: [
            { projectId: "ready", title: "Ready", active: true, ready: true },
          ],
        };
      throw new Error("Desktop restarted during the outline query.");
    });

    const report = await runCliDoctor(request, "22.12.0");

    expect(report.ok).toBe(false);
    expect(report.checks).toEqual([
      expect.objectContaining({ id: "node", status: "pass" }),
      expect.objectContaining({ id: "desktop-broker", status: "pass" }),
      expect.objectContaining({
        id: "active-document",
        status: "fail",
        message: "Desktop restarted during the outline query.",
      }),
    ]);
  });
});
