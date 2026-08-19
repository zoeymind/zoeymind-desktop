// @ts-nocheck — desktop mirror of cloud AI chat; runtime bridged via bridge.tsx
/**
 * 工具调用埋点统计 — 把每次工具执行结果累加到 conversationId 维度,
 * 由 useToolDispatcher 调用 record() 累积, 由 useAIChat 在 conversation 切换 / 卸载时统一上报.
 *
 * 提取自原 useAIChat.ts (≥ 100 行内联逻辑).
 */

import type { ToolArgs } from '../../../ai-chat/types'
import type { ExecutionResult } from '../../../ai-chat/tools/types'

export interface ToolUsageSummary {
  toolCount: number
  moduleAdded: number
  moduleUpdated: number
  moduleDeleted: number
  caseAdded: number
  caseUpdated: number
  caseDeleted: number
}

export const createEmptyToolUsageSummary = (): ToolUsageSummary => ({
  toolCount: 0,
  moduleAdded: 0,
  moduleUpdated: 0,
  moduleDeleted: 0,
  caseAdded: 0,
  caseUpdated: 0,
  caseDeleted: 0
})

const getArrayLength = (value: unknown): number => (Array.isArray(value) ? value.length : 0)

const ensureNumber = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : 0

const countSuccessFromResults = (resultData: unknown): number => {
  if (!Array.isArray(resultData)) return 0
  return resultData.filter(item => {
    if (item && typeof item === 'object' && 'success' in item) {
      return (item as { success?: boolean }).success !== false
    }
    return true
  }).length
}

/**
 * 根据工具名和执行结果, 算出本次操作对 ToolUsageSummary 的增量.
 * 失败的项不计入 (除 add_* 因为它们的 data.length 已经只含成功)
 */
export function calculateOperationDelta(
  toolName: string,
  args: ToolArgs,
  result: ExecutionResult
): Omit<ToolUsageSummary, 'toolCount'> {
  const delta: Omit<ToolUsageSummary, 'toolCount'> = {
    moduleAdded: 0,
    moduleUpdated: 0,
    moduleDeleted: 0,
    caseAdded: 0,
    caseUpdated: 0,
    caseDeleted: 0
  }

  switch (toolName) {
    case 'add_module':
      delta.moduleAdded = ensureNumber(
        Array.isArray(result.data)
          ? result.data.length
          : getArrayLength((args as { modules?: unknown[] }).modules)
      )
      break
    case 'update_module':
      delta.moduleUpdated = ensureNumber(
        countSuccessFromResults(result.data) ||
          getArrayLength((args as { updates?: unknown[] }).updates)
      )
      break
    case 'delete_module':
      delta.moduleDeleted = ensureNumber(
        countSuccessFromResults(result.data) ||
          getArrayLength((args as { moduleIds?: unknown[] }).moduleIds)
      )
      break
    case 'add_cases':
      delta.caseAdded = ensureNumber(
        (result.data as { caseCount?: number } | undefined)?.caseCount ??
          getArrayLength((args as { cases?: unknown[] }).cases)
      )
      break
    case 'update_cases':
      delta.caseUpdated = ensureNumber(
        (result.data as { successCount?: number } | undefined)?.successCount ??
          getArrayLength((args as { updates?: unknown[] }).updates)
      )
      break
    case 'delete_cases':
      delta.caseDeleted = ensureNumber(
        (result.data as { deletedCount?: number } | undefined)?.deletedCount ??
          getArrayLength((args as { caseIds?: unknown[] }).caseIds)
      )
      break
    default:
      break
  }

  return delta
}
