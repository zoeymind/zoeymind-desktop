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

  it("preserves the disabled-or-missing Desktop recovery instruction", () => {
    expect(DOCUMENT_PORTAL_UNAVAILABLE).toContain("enable External automation");
  });
});
