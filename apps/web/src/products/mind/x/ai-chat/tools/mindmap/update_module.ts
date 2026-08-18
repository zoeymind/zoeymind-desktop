// @ts-nocheck — dormant AI chat / MCP module (bridge.tsx flattens to no-op)
import { logger } from '@zoeymind/logger'
import { UpdateModuleSchema } from '@zoeymind/shared'
import type { Tool, ExecutionResult } from '../../../ai-chat/tools/types'
import { buildMindMapUidIndex, type MindMapNodeTree } from './mindmap-node-tree'

/**
 * 批量更新模块工具
 *
 * 直接操作数据层（getData → 修改 → updateData），
 * 与 update-cases 保持一致，避免依赖渲染层（renderer.findNodeByUid）。
 * 这样即使节点被折叠也能正确更新，且不会导致视图跳转。
 */
export const updateModuleTool: Tool = {
  name: 'update_module',
  label: '更新模块',
  description:
    '批量更新测试模块信息（名称、描述等）。**建议一次性更新所有需要修改的模块**，而不是逐个更新，可以提高效率。',
  parameters: {
    updates: {
      type: 'array',
      description:
        '要更新的模块列表，每项包含 moduleId（模块ID）、name（新名称，可选）、description（新描述，可选）',
      required: true
    }
  },
  handler: async (args, context): Promise<ExecutionResult> => {
    const parseResult = UpdateModuleSchema.safeParse(args)
    if (!parseResult.success) {
      const firstError = parseResult.error.issues[0]
      return {
        success: false,
        error:
          firstError.message +
          (firstError.path.length > 0 ? ` (路径: ${firstError.path.join('.')})` : '')
      }
    }

    const { updates } = parseResult.data
    const { mindMap } = context

    if (!mindMap) {
      return {
        success: false,
        error: '思维导图未初始化'
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
    const results: Array<{
      moduleId: string
      moduleName?: string
      success: boolean
      error?: string
    }> = []
    const ztdlOk: string[] = []
    const ztdlFail: string[] = []
    let hasMutation = false

    for (const update of updates) {
      const resolvedId = context.idMapper.tryResolve(update.moduleId)
      const entry = uidIndex.get(resolvedId)
      const shortId = idMapper.shorten(update.moduleId)
      if (!entry) {
        logger.warn('[updateModuleTool] 未找到模块节点', { moduleId: update.moduleId })
        results.push({ moduleId: update.moduleId, success: false, error: '模块不存在' })
        ztdlFail.push(`!M:${shortId} ID不存在`)
        continue
      }

      const { node } = entry
      const nodeData = node.data

      const icons = nodeData?.icon || []
      const isModule = Array.isArray(icons) && icons.includes('sign_2')
      if (!isModule) {
        logger.warn('[updateModuleTool] 节点不是模块', { moduleId: update.moduleId })
        results.push({ moduleId: update.moduleId, success: false, error: '该节点不是模块' })
        ztdlFail.push(`!M:${shortId} 不是模块节点`)
        continue
      }

      try {
        if (update.name !== undefined || update.description !== undefined) {
          const currentText = nodeData?.text || ''
          const lines = currentText.split('\n')
          const currentName = lines[0] || ''
          const currentDesc = lines.slice(1).join('\n')

          const finalName = update.name !== undefined ? update.name : currentName
          const finalDesc = update.description !== undefined ? update.description : currentDesc

          if (nodeData) {
            nodeData.text = finalDesc ? `${finalName}\n${finalDesc}` : finalName
          }
          hasMutation = true
        }

        const moduleName = update.name || (nodeData?.text || '').split('\n')[0]
        ztdlOk.push(`~M:${shortId} ${moduleName}`)
        results.push({ moduleId: update.moduleId, moduleName, success: true })
      } catch (error) {
        const reason = error instanceof Error ? error.message : '更新失败'
        logger.error('[updateModuleTool] 更新模块失败', { moduleId: update.moduleId, error })
        results.push({ moduleId: update.moduleId, success: false, error: reason })
        ztdlFail.push(`!M:${shortId} ${reason}`)
      }
    }

    const successCount = results.filter(r => r.success).length
    const failedCount = updates.length - successCount

    if (successCount === 0) {
      const failDetail = ztdlFail.join('\n')
      return {
        success: false,
        error: '所有模块更新失败',
        data: results,
        ztdl: failDetail
      }
    }

    if (hasMutation) {
      try {
        mindMap.updateData(snapshot)
      } catch (error) {
        return {
          success: false,
          error: `批量更新模块失败: ${error instanceof Error ? error.message : String(error)}`
        }
      }
    }

    const ztdlParts = [...ztdlOk, ...ztdlFail]
    const header = `~${successCount}ok${failedCount > 0 ? `/${failedCount}fail` : ''}`

    return {
      success: successCount > 0,
      data: results,
      ztdl: `${header}\n${ztdlParts.join('\n')}`
    }
  }
}