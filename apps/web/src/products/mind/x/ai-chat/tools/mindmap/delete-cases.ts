// @ts-nocheck — desktop mirror of cloud AI chat; runtime bridged via bridge.tsx
import type { Tool, ExecutionResult } from '../../../ai-chat/tools/types'
import { logger } from '@zoeymind/logger'
import { buildMindMapUidIndex, type MindMapNodeTree } from './mindmap-node-tree'

export const deleteCasesTool: Tool = {
  name: 'delete_cases',
  label: '删除用例',
  description:
    '批量删除测试用例。**建议一次性删除所有需要删除的用例**，而不是逐个删除，可以提高效率。此工具支持批量操作，可以一次性删除多个用例。',
  parameters: {
    caseIds: {
      type: 'array',
      items: { type: 'string' },
      description: '要删除的用例ID数组',
      required: true
    }
  },
  handler: async (args, context): Promise<ExecutionResult> => {
    const { mindMap } = context
    const { caseIds } = args as { caseIds: string[] }

    if (!mindMap) {
      return {
        success: false,
        error: '思维导图实例不存在'
      }
    }

    if (!Array.isArray(caseIds) || caseIds.length === 0) {
      return {
        success: false,
        error: 'caseIds 必须是非空数组'
      }
    }

    const snapshot = mindMap.getData()

    if (!snapshot) {
      return {
        success: false,
        error: '无法获取思维导图数据'
      }
    }

    const { idMapper } = context
    const uidIndex = buildMindMapUidIndex(snapshot)
    let deletedCount = 0
    const ztdlOk: string[] = []
    const ztdlFail: string[] = []

    for (const caseId of caseIds) {
      const resolvedId = context.idMapper.tryResolve(caseId)
      const shortId = idMapper.shorten(caseId)
      try {
        const entry = uidIndex.get(resolvedId)
        if (!entry) {
          logger.warn(`[deleteCasesTool] 未找到用例节点: ${caseId}`)
          ztdlFail.push(`!C:${shortId} 用例不存在`)
          continue
        }

        const { node, parent } = entry
        if (!parent || !Array.isArray(parent.children)) {
          logger.warn(`[deleteCasesTool] 用例节点没有父节点: ${caseId}`)
          ztdlFail.push(`!C:${shortId} 节点无父级，无法删除`)
          continue
        }

        const text = node.data?.text || ''
        ztdlOk.push(`-C:${shortId} ${text}`)

        parent.children = parent.children.filter(child => child !== node)
        uidIndex.delete(caseId)
        deletedCount++
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error)
        logger.error(`[deleteCasesTool] 删除用例节点失败: ${caseId}`, error)
        ztdlFail.push(`!C:${shortId} ${reason}`)
      }
    }

    if (deletedCount === 0) {
      const failDetail = ztdlFail.length > 0 ? `\n${ztdlFail.join('\n')}` : ''
      return {
        success: false,
        error: `未找到任何可删除的用例节点${failDetail}`
      }
    }

    try {
      mindMap.updateData(snapshot)
    } catch (error) {
      return {
        success: false,
        error: `删除用例失败: ${error instanceof Error ? error.message : String(error)}`
      }
    }

    const failedCount = caseIds.length - deletedCount
    const ztdlParts = [...ztdlOk, ...ztdlFail]
    const header = `-${deletedCount}ok${failedCount > 0 ? `/${failedCount}fail` : ''}`

    return {
      success: deletedCount > 0,
      data: {
        deletedCount,
        failedCount
      },
      ztdl: `${header}\n${ztdlParts.join('\n')}`
    }
  }
}
