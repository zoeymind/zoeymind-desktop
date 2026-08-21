// @ts-nocheck — desktop mirror of cloud AI chat; runtime bridged via bridge.tsx
/**
 * AIchatV2 工具类型定义
 *
 * 独立的类型定义，不依赖 @zoeymind/ai-agent
 */

import type MindMap from "simple-mind-map"
import type { ToolArgs } from "../../ai-chat/types"
import type { SessionIdMapper } from "./session-id-mapper"

// 重新导出 ToolArgs 供其他模块使用
export type { ToolArgs }

/**
 * 工具执行结果
 */
export interface ExecutionResult {
  success: boolean
  data?: unknown
  error?: string
  errorCode?: string
  details?: Record<string, unknown>
  /**
   * ZTDL 格式文本（面向 AI 的紧凑表示）
   * 如果存在，addToolResult 时会用此字段替代 data 传给 AI，
   * 而 data 仍用于 UI 渲染
   */
  ztdl?: string
}

/**
 * 工具 UI 数据缓存
 *
 * addToolOutput 只发精简版给 AI（ztdl 或 error），
 * 完整的 ExecutionResult（含 data）缓存在这里供 ToolCallCard UI 渲染使用。
 */
const toolUICache = new Map<string, ExecutionResult>()

export function cacheToolResult(toolCallId: string, result: ExecutionResult) {
  toolUICache.set(toolCallId, result)
}

export function getCachedToolResult(toolCallId: string): ExecutionResult | undefined {
  return toolUICache.get(toolCallId)
}

/**
 * 从完整结果中提取发给 AI 模型的精简输出（去掉 data，保留 ztdl）
 * - 有 ztdl: { success, ztdl, error? }
 * - 无 ztdl + 失败: { success: false, error }
 * - 无 ztdl + 成功: 发精简版 { success, message }
 *
 * ⚠️ ztdl 必须是纯文本，不能包含 HTML 标签
 */
export function toModelOutput(result: ExecutionResult): unknown {
  if (result.ztdl) {
    // 确保 ztdl 是纯文本，去除可能的 HTML 标签
    const cleanZtdl = result.ztdl.replace(/<[^>]*>/g, "")
    const out: { success: boolean; ztdl: string; error?: string } = {
      success: result.success,
      ztdl: cleanZtdl,
    }
    if (!result.success && result.error) out.error = result.error
    return out
  }
  if (!result.success) {
    return {
      success: false,
      error: result.error,
      errorCode: result.errorCode,
      details: result.details,
    }
  }
  // 成功但无 ztdl：返回精简版
  if (result.data && typeof result.data === "object") {
    const data = result.data as Record<string, unknown>
    return {
      success: true,
      message: data.message || "操作成功",
    }
  }
  return { success: true }
}

/**
 * 工具上下文
 */
export interface ToolContext {
  mindMap: MindMap
  idMapper: SessionIdMapper
}

/**
 * AI 预分配的短 ID 及其在输入数组中的索引
 */
export interface PreAssignedId {
  shortId: string
  index: number
}

/**
 * 扩展的预分配 ID 信息（含 AI 请求的原始 ID）
 */
export interface PreAssignedIdWithRequested {
  shortId: string // 实际分配的 ID
  index: number
  requestedId: string // AI 请求的 ID（可能因重复而自动添加后缀）
}

/**
 * 工具执行后，将 AI 预分配的 shortId 绑定到实际生成的 UUID
 *
 * 关键：绑定后需要重新生成 ztdl，确保使用预分配 ID 而非自动分配的 ID
 */
export function bindPreAssignedIds(
  toolName: string,
  result: ExecutionResult,
  preAssignedIds: PreAssignedId[],
  mapper: SessionIdMapper
): void {
  if (!result.success || preAssignedIds.length === 0) {
    if (!result.success) {
      for (const { shortId } of preAssignedIds) {
        mapper.unreserve(shortId)
      }
    }
    return
  }

  if (toolName === "add_module" && Array.isArray(result.data)) {
    for (const { shortId, index } of preAssignedIds) {
      const item = (result.data as Array<{ moduleId?: string }>)[index]
      if (item?.moduleId) {
        mapper.bind(shortId, item.moduleId)
      } else {
        mapper.unreserve(shortId)
      }
    }

    // 重新生成 ztdl，使用实际分配的 ID
    const results = result.data as Array<{ moduleId?: string; moduleName: string }>
    const ztdlLines = results.map(r => {
      const shortId = r.moduleId ? mapper.shorten(r.moduleId) : "?"
      return `M:${shortId} ${r.moduleName}`
    })
    result.ztdl = `+${results.length}模块:\n${ztdlLines.join("\n")}`
  }

  if (toolName === "add_cases") {
    const data = result.data
    if (isAddCasesResult(data)) {
      const { moduleId, caseIds } = data

      for (const { shortId, index } of preAssignedIds) {
        if (index < caseIds.length && caseIds[index]) {
          mapper.bind(shortId, caseIds[index])
        } else {
          mapper.unreserve(shortId)
        }
      }

      // 重新生成 ztdl，使用预分配 ID
      const moduleShort = mapper.shorten(moduleId)
      const ztdlLines = caseIds.map(uid => {
        const shortId = mapper.shorten(uid)
        return `+C:${shortId} > M:${moduleShort}`
      })
      result.ztdl = `+${caseIds.length}用例:\n${ztdlLines.join("\n")}`
    } else {
      for (const { shortId } of preAssignedIds) {
        mapper.unreserve(shortId)
      }
    }
  }
}

/**
 * 工具参数定义
 */
/**
 * 类型守卫辅助函数
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isAddCasesResult(data: unknown): data is { moduleId: string; caseIds: string[] } {
  if (!isRecord(data)) return false

  const moduleId = data.moduleId
  const caseIds = data.caseIds

  return (
    typeof moduleId === "string" &&
    Array.isArray(caseIds) &&
    caseIds.every(id => typeof id === "string")
  )
}

export interface ToolParameter {
  type: string
  description: string
  required?: boolean
  default?: unknown
  items?: ToolParameterItems
}

/**
 * 工具参数的 items 定义（用于数组类型）
 */
export interface ToolParameterItems {
  type: string
  properties?: Record<string, ToolParameter>
  required?: string[]
}

/**
 * 工具定义
 */
export interface Tool {
  name: string
  label?: string
  description: string
  parameters: Record<string, ToolParameter> | Record<string, never>
  handler: (args: ToolArgs, context: ToolContext) => Promise<ExecutionResult>
  config?: {
    timeout?: number
    validate?: (args: ToolArgs) => boolean
  }
}
