// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest"
import JSZip from "jszip"
import { transformToXmind } from "simple-mind-map/src/parse/xmind-export"

import {
  createMindMapExport,
  EXPORT_FORMATS,
  IMPORT_ACCEPT,
  IMPORT_EXTENSIONS,
  sanitizeExportFilename,
} from "./fileFormats"

describe("desktop mind map file formats", () => {
  it("keeps picker declarations aligned with supported project imports", () => {
    expect(IMPORT_EXTENSIONS).toEqual(["xmind", "md", "zip"])
    expect(IMPORT_ACCEPT).toBe(".xmind,.md,.zip")
  })

  it("exposes every implemented export format", () => {
    expect(EXPORT_FORMATS).toEqual([
      "png",
      "svg",
      "pdf",
      "md",
      "json",
      "txt",
      "xmind",
      "zmxmind",
      "zip",
    ])
  })

  it("produces a portable non-empty export filename", () => {
    expect(sanitizeExportFilename(" Roadmap: Q3 / Q4? ")).toBe("Roadmap_ Q3 _ Q4_")
    expect(sanitizeExportFilename("...   ")).toBe("Untitled")
    expect(sanitizeExportFilename(null)).toBe("Untitled")
  })
  it.each(EXPORT_FORMATS)("creates non-empty %s export bytes", async format => {
    const tree = {
      data: { text: "Roadmap", uid: "root" },
      children: [{ data: { text: "Release", uid: "child" }, children: [] }],
    }
    const mindMap = {
      renderer: {},
      getData: () => tree,
      doExport: {
        png: vi.fn(async () => "png-data"),
        svg: vi.fn(async () => "<svg></svg>"),
        pdf: vi.fn(async () => new Blob(["pdf-data"])),
        json: vi.fn(async () => JSON.stringify(tree)),
        txt: vi.fn(async () => "Roadmap\nRelease"),
      },
      doExportXMind: {
        xmind: vi.fn(async () => new Blob(["xmind-data"])),
      },
    }

    const bytes = await createMindMapExport(mindMap as never, format)
    expect(bytes.byteLength).toBeGreaterThan(0)
    if (format === "zip") expect(Array.from(bytes.slice(0, 2))).toEqual([80, 75])
  })

  it("creates a valid XMind archive through the real exporter", async () => {
    const blob = await transformToXmind(
      {
        data: { text: "Roadmap", uid: "root" },
        children: [{ data: { text: "Release", uid: "child" }, children: [] }],
      },
      "Roadmap"
    )
    const archive = await JSZip.loadAsync(await blob.arrayBuffer())
    const contentFile = archive.file("content.json")

    expect(contentFile).not.toBeNull()
    expect(archive.file("content.xml")).not.toBeNull()
    expect(archive.file("manifest.json")).not.toBeNull()
    expect(archive.file("metadata.json")).not.toBeNull()

    const [sheet] = JSON.parse(await contentFile!.async("string"))
    expect(sheet.rootTopic.title).toBe("Roadmap")
    expect(sheet.rootTopic.children.attached[0].title).toBe("Release")
  })
})
