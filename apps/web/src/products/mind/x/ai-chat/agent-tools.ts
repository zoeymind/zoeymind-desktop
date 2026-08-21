import { tool } from "ai"
import { QuestionSchema } from "@zoeymind/shared"
import {
  CurrentDocumentEditToolInputSchema,
  CurrentDocumentReadToolInputSchema,
  CurrentDocumentSearchToolInputSchema,
} from "@/products/mind/document-portal/current-document-adapter"

const AGENT_TOOL_LABELS: Record<string, string> = {
  search: "搜索当前文档",
  read: "读取当前文档",
  edit: "编辑当前文档",
  question: "向用户提问",
}

export function getToolLabel(toolName: string): string {
  return AGENT_TOOL_LABELS[toolName] ?? toolName
}
export function getAgentTools() {
  return {
    search: tool({
      description:
        "Search the current ready Test Document. Read a hit's readPath for local content.",
      inputSchema: CurrentDocumentSearchToolInputSchema,
    }),
    read: tool({
      description:
        "Read the current ready Test Document. Use outline first, then subtree for bounded local content.",
      inputSchema: CurrentDocumentReadToolInputSchema,
    }),
    edit: tool({
      description:
        "Apply an atomic patch to the current ready Test Document using a read anchorTag. Use preview before destructive changes.",
      inputSchema: CurrentDocumentEditToolInputSchema,
    }),
    question: tool({
      description: "Ask the user structured questions.",
      inputSchema: QuestionSchema,
    }),
  }
}
