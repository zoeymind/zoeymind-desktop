/**
 * 本模块 tRPC 端点的返回形态。
 *
 * 与后端 zod schema 对应，供 `lib/trpc.ts` 的泛型调用点标注。
 * 只声明前端实际读取的字段；可选字段用 `?:` 表示缺省，不用 `| null`
 * —— 后端这些字段是省略而非置空。
 */

/** `models.list` */
export interface ModelListResult {
  items: {
    modelId: string
    name: string
    description?: string
    provider: string
    supportsVision?: boolean
    supportsTools?: boolean
    iconUrl?: string
    contextLength?: number
    pricingNote?: string
  }[]
  defaultModelId?: string
}

/** `mcp.list` 单项 */
export interface McpServerItem {
  id: string
  name: string
  url: string
  preset: string | null
  maskedToken: string | null
  headers: Record<string, string>
  disabled: boolean
}

/** `mcp.listPresets` 单项 */
export interface McpPresetItem {
  id: string
  name: string
  defaultUrl: string
  tokenHeader: string
  tokenHint: string | null
}

/** `mcp.testConnection` */
export interface McpTestResult {
  success: boolean
  message?: string
  toolCount?: number
  tools?: { name: string; description?: string }[]
}

/** `mcp.probeTools` */
export interface McpProbeResult {
  tools: {
    name: string
    description?: string
  }[]
}

/** `aiV2.getTools` */
export interface AiToolListResult {
  tools: {
    name: string
    label?: string
    description?: string
    enabled?: boolean
  }[]
}

/** `prompt.listMyPrompts` 单项 */
export interface PromptItem {
  id: string
  title: string
  isEnabled: boolean
}
