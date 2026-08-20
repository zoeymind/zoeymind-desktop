import JSZip from "jszip"
import { describe, expect, it } from "vitest"

import { parseMindMapImport } from "./importMindMapFile"

async function archiveFile(name: string, entries: Record<string, string>): Promise<File> {
  const zip = new JSZip()
  for (const [path, content] of Object.entries(entries)) zip.file(path, content)
  return new File([await zip.generateAsync({ type: "arraybuffer" })], name)
}

describe("mind map import dispatch", () => {
  it("imports Markdown", async () => {
    const tree = await parseMindMapImport(new File(["# Roadmap\n## Release"], "roadmap.md"))
    expect(tree.data.text).toBeTruthy()
    expect(tree.children.length).toBeGreaterThan(0)
  })

  it("imports a standard XMind 2020 archive", async () => {
    const file = await archiveFile("roadmap.xmind", {
      "content.json": JSON.stringify([
        {
          id: "sheet-1",
          rootTopic: {
            id: "root-1",
            title: "Roadmap",
            children: { attached: [{ id: "child-1", title: "Release" }] },
          },
        },
      ]),
    })
    const tree = await parseMindMapImport(file)
    expect(tree.data.text).toBe("Roadmap")
    expect(tree.children[0]?.data.text).toBe("Release")
  })

  it("imports MeterSphere XMind semantics", async () => {
    const file = await archiveFile("cases.xmind", {
      "content.json": JSON.stringify([
        {
          id: "sheet-1",
          rootTopic: {
            id: "root-1",
            title: "Cases",
            children: { attached: [{ id: "case-1", title: "case：Login" }] },
          },
        },
      ]),
    })
    const tree = await parseMindMapImport(file, "zm")
    expect(tree.data.text).toBe("Cases")
    expect(tree.children[0]?.data.text).toBe("Login")
  })

  it("imports nested ZIP folders and index Markdown", async () => {
    const file = await archiveFile("suite.zip", {
      "Auth/index.md": "- Login\n  - Expected result",
    })
    const tree = await parseMindMapImport(file)
    expect(tree.data.text).toBe("suite")
    expect(tree.children[0]?.data.text).toBe("Auth")
    expect(tree.children[0]?.children[0]?.data.text).toBe("Login")
  })

  it("rejects undeclared extensions", async () => {
    await expect(parseMindMapImport(new File(["{}"], "map.markdown"))).rejects.toThrow(
      "Unsupported import file"
    )
  })
})
