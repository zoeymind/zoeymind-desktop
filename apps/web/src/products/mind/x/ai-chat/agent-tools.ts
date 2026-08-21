import { tool } from "ai"
import { QuestionSchema } from "@zoeymind/shared"
import {
  CurrentDocumentEditToolInputSchema,
  CurrentDocumentQueryToolInputSchema,
} from "@/products/mind/document-portal/current-document-adapter"

const AGENT_TOOL_LABELS: Record<string, string> = {
  query_current_mindmap: "查询当前思维导图",
  edit_current_mindmap: "编辑当前思维导图",
  question: "向用户提问",
}

export function getToolLabel(toolName: string): string {
  return AGENT_TOOL_LABELS[toolName] ?? toolName
}
export function getAgentTools() {
  return {
    query_current_mindmap: tool({
      description:
        "Inspect the user's currently open mind map. Its tree is your complete workspace: use outline for structure, subtree for complete local content, and search to locate modules or cases. Omit path or scope to query the whole tree.",
      inputSchema: CurrentDocumentQueryToolInputSchema,
    }),
    edit_current_mindmap: tool({
      description:
        "Edit the user's currently open mind map using anchorTag and line numbers from the current view. The result includes a fresh bounded view and anchorTag for immediate follow-up edits; query again only when the next target is outside that view, truncated, or conflicted.",
      inputSchema: CurrentDocumentEditToolInputSchema,
    }),
    question: tool({
      description: "Ask the user structured questions.",
      inputSchema: QuestionSchema,
    }),
  }
}
