import { afterEach, describe, expect, it, vi } from "vitest";
import {
  __test__,
  DOCUMENT_PORTAL_UNAVAILABLE,
  isValidDocumentPortalDescriptor,
  requestDocumentPortal,
} from "@zoeymind-desktop/document-portal-client/node";

const validDescriptor = {
  version: 1 as const,
  pid: 42,
  port: 3210,
  token: "a".repeat(64),
};

afterEach(() => vi.unstubAllGlobals());

describe("Broker client compatibility contract", () => {
  it("resolves descriptor paths on every supported desktop OS", () => {
    expect(__test__.descriptorPath("darwin", "/home/user", {})).toBe(
      "/home/user/Library/Application Support/com.zoeymind.desktop/document-portal-broker.json",
    );
    expect(
      __test__.descriptorPath("win32", "C:\\Users\\user", {
        LOCALAPPDATA: "D:\\Local",
      }),
    ).toBe("D:\\Local\\com.zoeymind.desktop\\document-portal-broker.json");
    expect(
      __test__.descriptorPath("linux", "/home/user", {
        XDG_DATA_HOME: "/data",
      }),
    ).toBe("/data/com.zoeymind.desktop/document-portal-broker.json");
  });

  it("accepts protocol 1 and rejects stale or unknown descriptors", () => {
    expect(isValidDocumentPortalDescriptor(validDescriptor)).toBe(true);
    expect(
      isValidDocumentPortalDescriptor({ ...validDescriptor, version: 2 }),
    ).toBe(false);
    expect(
      isValidDocumentPortalDescriptor({ ...validDescriptor, token: "stale" }),
    ).toBe(false);
    expect(
      isValidDocumentPortalDescriptor({ ...validDescriptor, port: 0 }),
    ).toBe(false);
  });

  it("reports Desktop shutdown or restart during a request", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("ECONNREFUSED")),
    );
    await expect(
      requestDocumentPortal(
        "projects",
        { action: "list" },
        async () => validDescriptor,
      ),
    ).rejects.toThrow("desktop app may have closed");
  });

  it("filters project metadata locally without extending the Broker protocol", async () => {
    const fetchMock = vi.fn(
      async (_input: string | URL | Request, _init?: RequestInit) =>
        new Response(
          JSON.stringify({
            success: true,
            projects: [
              { projectId: "target", title: "Acceptance" },
              { projectId: "other", title: "Other" },
            ],
          }),
        ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      requestDocumentPortal(
        "projects",
        { action: "list", projectId: "target", title: "Acceptance" },
        async () => validDescriptor,
      ),
    ).resolves.toEqual({
      success: true,
      projects: [{ projectId: "target", title: "Acceptance" }],
    });
    expect(JSON.parse(fetchMock.mock.calls[0]![1]!.body as string)).toEqual({
      tool: "projects",
      input: { action: "list" },
    });
  });

  it("normalizes extra Agent context only at the Broker seam", async () => {
    const fetchMock = vi.fn(
      async (_input: string | URL | Request, _init?: RequestInit) =>
        new Response(JSON.stringify({ success: true })),
    );
    vi.stubGlobal("fetch", fetchMock);

    await requestDocumentPortal(
      "projects",
      { action: "create", title: "Draft", projectId: "ignored" },
      async () => validDescriptor,
    );
    await requestDocumentPortal(
      "query_current_mindmap",
      { mode: "outline", query: "ignored", extra: true },
      async () => validDescriptor,
    );
    await requestDocumentPortal(
      "query_current_mindmap",
      { mode: "search", query: "case", path: ["ignored"], extra: true },
      async () => validDescriptor,
    );
    await requestDocumentPortal(
      "activate_project",
      { projectId: "target", note: "ignored" },
      async () => validDescriptor,
    );
    await requestDocumentPortal(
      "edit_current_mindmap",
      {
        anchorTag: "A",
        patch: "PUT 1.=1:\n+Done",
        preview: true,
        note: "ignored",
      },
      async () => validDescriptor,
    );

    expect(
      fetchMock.mock.calls.map(([, init]) => JSON.parse(init!.body as string)),
    ).toEqual([
      { tool: "projects", input: { action: "create", title: "Draft" } },
      { tool: "query_current_mindmap", input: { mode: "outline" } },
      {
        tool: "query_current_mindmap",
        input: { mode: "search", query: "case" },
      },
      { tool: "activate_project", input: { projectId: "target" } },
      {
        tool: "edit_current_mindmap",
        input: { anchorTag: "A", patch: "PUT 1.=1:\n+Done", preview: true },
      },
    ]);
  });

  it("summarizes complete outlines but never reports partial counts", async () => {
    const responses = [
      {
        success: true,
        truncated: false,
        content: [
          "1: # Password reset",
          "2:   [P1] Happy path & ready",
          "3:   [P2] Invalid token & expired",
          "4:   [P2] Reused token & consumed",
        ].join("\n"),
      },
      {
        success: true,
        truncated: true,
        content: "1:   [P1] Partial",
      },
    ];
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify(responses.shift()))),
    );

    await expect(
      requestDocumentPortal(
        "query_current_mindmap",
        { mode: "outline" },
        async () => validDescriptor,
      ),
    ).resolves.toMatchObject({
      summary: { caseCount: 3, priorityCounts: { P1: 1, P2: 2, P3: 0 } },
    });
    await expect(
      requestDocumentPortal(
        "query_current_mindmap",
        { mode: "outline", maxLines: 1 },
        async () => validDescriptor,
      ),
    ).resolves.not.toHaveProperty("summary");
  });

  it("preserves the missing Desktop recovery instruction", () => {
    expect(DOCUMENT_PORTAL_UNAVAILABLE).toContain("Open or reopen Desktop");
  });
});
