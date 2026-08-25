import type { ToolSet } from "ai"

export function describeRuntimeTools(tools: ToolSet): string {
  const entries = Object.entries(tools)
  if (entries.length === 0) return ""
  const lines = entries.map(([name, definition]) => {
    const description = definition.description?.trim()
    return description ? `- ${name}: ${description}` : `- ${name}`
  })
  return [
    "Runtime tools available in this turn:",
    ...lines,
    "MCP tools are directly callable when their names start with `mcp_`; they are real external MCP tools, not mind-map aliases.",
    "When asked what you can do, answer from this runtime list. Do not claim that MCP is unavailable when `mcp_` tools are listed.",
  ].join("\n")
}
