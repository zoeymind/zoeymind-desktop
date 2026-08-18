// @ts-nocheck — dormant AI chat / MCP module (bridge.tsx flattens to no-op)
/**
 * resolveToolInput — 把工具入参里的短 ID resolve 成 UUID, 同时把创建型工具 (add_module / add_cases)
 * 的预分配 ID reserve 出来, 后续 bindPreAssignedIds 时使用. 提取自原 useAIChat.ts.
 */

import type { PreAssignedId } from '../../../ai-chat/tools/types'
import type { SessionIdMapper } from '../../../ai-chat/tools/session-id-mapper'

export interface ResolvedToolInput {
  resolved: Record<string, unknown>
  preAssignedIds: PreAssignedId[]
  preAssignedIdsWithRequested: Array<{
    shortId: string
    index: number
    requestedId: string
  }>
}

export function resolveToolInput(
  toolName: string,
  input: Record<string, unknown>,
  mapper: SessionIdMapper
): ResolvedToolInput {
  const resolved = structuredClone(input) as Record<string, unknown>

  // resolve 所有引用型 ID 字段（对于 reserved ID 返回占位符，支持同轮引用）
  if (typeof resolved.moduleId === 'string') {
    resolved.moduleId = mapper.resolveReserved(resolved.moduleId)
  }
  if (typeof resolved.parentModuleId === 'string') {
    resolved.parentModuleId = mapper.resolveReserved(resolved.parentModuleId)
  }
  if (Array.isArray(resolved.moduleIds)) {
    resolved.moduleIds = (resolved.moduleIds as string[]).map(id => mapper.resolveReserved(id))
  }
  if (Array.isArray(resolved.caseIds)) {
    resolved.caseIds = (resolved.caseIds as string[]).map(id => mapper.resolveReserved(id))
  }
  if (Array.isArray(resolved.updates)) {
    for (const u of resolved.updates as Record<string, unknown>[]) {
      if (typeof u.moduleId === 'string') u.moduleId = mapper.resolveReserved(u.moduleId)
      if (typeof u.caseId === 'string') u.caseId = mapper.resolveReserved(u.caseId)
    }
  }

  // 提取并 reserve 创建型 ID 字段; 出错时回滚已 reserve 的, 防止泄露
  const preAssignedIdsWithRequested: Array<{
    shortId: string
    index: number
    requestedId: string
  }> = []

  const reserveWithCleanup = (requestedId: string, index: number): string => {
    try {
      const actualId = mapper.reserve(requestedId)
      preAssignedIdsWithRequested.push({ shortId: actualId, index, requestedId })
      return actualId
    } catch (e) {
      for (const { shortId } of preAssignedIdsWithRequested) {
        mapper.unreserve(shortId)
      }
      throw e
    }
  }

  if (toolName === 'add_module' && Array.isArray(resolved.modules)) {
    const modules = resolved.modules as Record<string, unknown>[]
    for (let i = 0; i < modules.length; i++) {
      const mod = modules[i]
      if (typeof mod.id === 'string' && mod.id) {
        reserveWithCleanup(mod.id, i)
        delete mod.id
      }
    }
  }
  if (toolName === 'add_cases' && Array.isArray(resolved.cases)) {
    const cases = resolved.cases as Record<string, unknown>[]
    for (let i = 0; i < cases.length; i++) {
      const c = cases[i]
      if (typeof c.id === 'string' && c.id) {
        reserveWithCleanup(c.id, i)
        delete c.id
      }
    }
  }

  // 转换为 PreAssignedId 格式（兼容现有 bindPreAssignedIds 接口）
  const preAssignedIds: PreAssignedId[] = preAssignedIdsWithRequested.map(({ shortId, index }) => ({
    shortId,
    index
  }))

  return { resolved, preAssignedIds, preAssignedIdsWithRequested }
}