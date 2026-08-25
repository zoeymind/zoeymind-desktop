import { describe, expect, it } from "vitest"
import { tool } from "ai"
import { z } from "zod"
import { describeRuntimeTools } from "./runtime-tools"

describe("describeRuntimeTools", () => {
  it("lists the actual MCP tools available in the current turn", () => {
    const prompt = describeRuntimeTools({
      query_current_mindmap: tool({
        description: "Inspect the current mind map",
        inputSchema: z.object({}),
      }),
      mcp_context7_resolve_library_id: tool({
        description: "Resolve a package name to a Context7 library ID",
        inputSchema: z.object({ query: z.string() }),
        execute: async () => ({}),
      }),
    })

    expect(prompt).toContain("mcp_context7_resolve_library_id")
    expect(prompt).toContain("Resolve a package name to a Context7 library ID")
    expect(prompt).toContain("MCP tools are directly callable")
  })
})
