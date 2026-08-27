import { describe, expect, it, vi } from "vitest";
import { requestDocumentPortal } from "./index.js";

describe("Document Portal CLI", () => {
  it("reports app absence without attempting a request", async () => {
    await expect(
      requestDocumentPortal("projects", { action: "list" }, async () => {
        throw new Error("missing");
      }),
    ).rejects.toThrow("missing");
  });
  it.each([
    ["projects", { action: "list" }],
    ["activate_project", { projectId: "live" }],
    ["query_current_mindmap", { mode: "outline" }],
    ["edit_current_mindmap", { anchorTag: "A", patch: "PUT 1.=1:\n+Done" }],
  ] as const)("forwards %s without Portal logic", async (tool, input) => {
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify({ success: true }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    await requestDocumentPortal(tool, input, async () => ({
      version: 1,
      pid: 1,
      port: 3210,
      token: "secret",
    }));
    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:3210/v1/document-portal",
      expect.objectContaining({ body: JSON.stringify({ tool, input }) }),
    );
  });
});
