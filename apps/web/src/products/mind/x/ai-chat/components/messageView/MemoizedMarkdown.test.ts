import { describe, expect, it } from "vitest"
import { splitMarkdownBlocks } from "./MemoizedMarkdown"

describe("splitMarkdownBlocks", () => {
  it("splits paragraphs at blank lines", () => {
    expect(splitMarkdownBlocks("para one\n\npara two\n\npara three")).toEqual([
      "para one",
      "para two",
      "para three",
    ])
  })

  it("keeps blank lines inside code fences", () => {
    const md = "before\n\n```ts\nconst a = 1\n\nconst b = 2\n```\n\nafter"
    expect(splitMarkdownBlocks(md)).toEqual([
      "before",
      "```ts\nconst a = 1\n\nconst b = 2\n```",
      "after",
    ])
  })

  it("keeps loose ordered lists in one block so numbering survives", () => {
    const md = "1. first\n\n2. second\n\n3. third"
    expect(splitMarkdownBlocks(md)).toEqual([md])
  })

  it("keeps indented continuations attached to their list", () => {
    const md = "- item\n\n    continuation paragraph\n\nnext para"
    expect(splitMarkdownBlocks(md)).toEqual(["- item\n\n    continuation paragraph", "next para"])
  })

  it("is prefix-stable while text streams in", () => {
    const partial = "para one\n\npara tw"
    const full = "para one\n\npara two\n\npara three"
    const before = splitMarkdownBlocks(partial)
    const after = splitMarkdownBlocks(full)
    expect(after.slice(0, before.length - 1)).toEqual(before.slice(0, -1))
  })

  it("returns the input for empty or whitespace text", () => {
    expect(splitMarkdownBlocks("")).toEqual([""])
  })
})
