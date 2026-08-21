/**
 * 桌面端 AI 工具静态清单 —— 来源: apps/zoeymind/x/api/services/ai-v2/tools.ts.
 * 桌面端后端不跑 trpc.aiV2.getTools, 用这个静态常量做本地 shim.
 *
 * name + label + description 三字段跟源保持一致 (源 getTools 返回也就这三个字段).
 */

export interface LocalAIToolInfo {
  name: string
  label?: string
  description?: string
  enabled?: boolean
}

export const LOCAL_AI_TOOLS: LocalAIToolInfo[] = [
  { name: "search", label: "搜索当前文档", description: "在当前 ready 的测试文档中搜索。" },
  { name: "read", label: "读取当前文档", description: "读取当前 ready 的测试文档大纲或子树。" },
  {
    name: "edit",
    label: "编辑当前文档",
    description: "使用 Tree Hashline patch 编辑当前 ready 的测试文档。",
  },
  { name: "question", label: "向用户提问", description: "向用户发起结构化澄清问题。" },
]
