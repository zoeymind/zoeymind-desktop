// @ts-nocheck — desktop mirror of cloud AI chat; runtime bridged via bridge.tsx
import { logger } from '@zoeymind/logger'
import { DeleteModuleSchema } from '@zoeymind/shared'
import type { Tool, ExecutionResult } from '../../../ai-chat/tools/types'
import { buildMindMapUidIndex, type MindMapNodeTree } from './mindmap-node-tree'

/**
 * 递归收集节点的所有子模块和用例
 */
function collectDescendants(
  node: MindMapNodeTree,
  idMapper: { shorten: (uuid: string) => string }
): {
  modules: Array<{ shortId: string; name: string }>
  cases: Array<{ shortId: string; name: string }>
} {
  const modules: Array<{ shortId: string; name: string }> = []
  const cases: Array<{ shortId: string; name: string }> = []

  function traverse(n: MindMapNodeTree) {
    if (!n.children) return

    for (const child of n.children) {
      const icons = child.data?.icon || []
      const isModule = icons.includes('sign_2')
      const isCase = icons.some((i: string) => i.startsWith('priority_'))
      const uid = child.data?.uid || ''
      const text = (child.data?.text || '').split('\n')[0]

      if (isModule) {
        modules.push({ shortId: idMapper.shorten(uid), name: text })
        traverse(child) // 继续递归
      } else if (isCase) {
        cases.push({ shortId: idMapper.shorten(uid), name: text })
      }
    }
  }

  traverse(node)
  return { modules, cases }
}

/**
 * 批量删除模块工具
 *
 * 直接操作数据层（getData → 修改 → updateData），
 * 与 delete-cases 保持一致，避免依赖渲染层（renderer.findNodeByUid）。
 * 这样即使节点被折叠也能正确删除，且不会导致视图跳转。
 *
 * 返回级联删除信息：删除模块时会自动删除其所有子模块和用例
 */
export const deleteModuleTool: Tool = {
  name: 'delete_module',
  label: '删除模块',
  description:
    '批量删除测试模块。**建议一次性删除所有需要删除的模块**，而不是逐个删除，可以提高效率。注意：删除模块会同时删除其下的所有子模块和用例',
  parameters: {
    moduleIds: {
      type: 'array',
      description: '要删除的模块ID列表',
      required: true
    }
  },
  handler: async (args, context): Promise<ExecutionResult> => {
    const parseResult = DeleteModuleSchema.safeParse(args)
    if (!parseResult.success) {
      const firstError = parseResult.error.issues[0]
      return {
        success: false,
        error:
          firstError.message +
          (firstError.path.length > 0 ? ` (路径: ${firstError.path.join('.')})` : '')
      }
    }

    const { moduleIds } = parseResult.data
    const { mindMap, idMapper } = context

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

    const uidIndex = buildMindMapUidIndex(snapshot)
    let deletedCount = 0
    const ztdlOk: string[] = []
    const ztdlFail: string[] = []
    const results: Array<{
      moduleId: string
      moduleName?: string
      success: boolean
      error?: string
      /** 级联删除的子模块短 ID 列表 */
      cascadedModules?: string[]
      /** 级联删除的用例短 ID 列表 */
      cascadedCases?: string[]
    }> = []

    for (const moduleId of moduleIds) {
      const resolvedId = context.idMapper.tryResolve(moduleId)
      const shortId = idMapper.shorten(moduleId)
      const entry = uidIndex.get(resolvedId)
      if (!entry) {
        logger.warn('[deleteModuleTool] 未找到模块节点', { moduleId })
        results.push({ moduleId, success: false, error: '模块不存在' })
        ztdlFail.push(`!M:${shortId} ID不存在`)
        continue
      }

      const { node, parent } = entry

      const icons = node.data?.icon || []
      const isModule = Array.isArray(icons) && icons.includes('sign_2')
      if (!isModule) {
        logger.warn('[deleteModuleTool] 节点不是模块', { moduleId })
        results.push({ moduleId, success: false, error: '该节点不是模块，无法删除' })
        ztdlFail.push(`!M:${shortId} 不是模块节点`)
        continue
      }

      if (!parent || !Array.isArray(parent.children)) {
        logger.warn('[deleteModuleTool] 模块节点没有父节点', { moduleId })
        results.push({ moduleId, success: false, error: '无法删除根节点' })
        ztdlFail.push(`!M:${shortId} 根节点不可删除`)
        continue
      }

      const moduleName = (node.data?.text || '未知模块').split('\n')[0]

      // 收集级联删除信息
      const descendants = collectDescendants(node, idMapper)
      const cascadedModules = descendants.modules.map(m => m.shortId)
      const cascadedCases = descendants.cases.map(c => c.shortId)

      // 构建 ztdl 输出（包含级联信息）
      let ztdlLine = `-M:${shortId} ${moduleName}`
      if (cascadedModules.length > 0 || cascadedCases.length > 0) {
        ztdlLine += ` # 级联: ${cascadedModules.length}子模块, ${cascadedCases.length}用例`
      }
      ztdlOk.push(ztdlLine)

      parent.children = parent.children.filter(child => child !== node)
      uidIndex.delete(moduleId)
      deletedCount++

      results.push({
        moduleId,
        moduleName,
        success: true,
        cascadedModules,
        cascadedCases
      })
    }

    if (deletedCount === 0) {
      const failDetail = ztdlFail.join('\n')
      return {
        success: false,
        error: `所有模块删除失败`,
        data: results,
        ztdl: failDetail
      }
    }

    try {
      mindMap.updateData(snapshot)
    } catch (error) {
      return {
        success: false,
        error: `删除模块失败: ${error instanceof Error ? error.message : String(error)}`
      }
    }

    const failedCount = moduleIds.length - deletedCount
    const ztdlParts = [...ztdlOk, ...ztdlFail]

    // 构建结构化返回数据
    const summary = {
      deletedCount,
      failedCount,
      deleted: results
        .filter(r => r.success)
        .map(r => ({
          id: idMapper.shorten(r.moduleId),
          name: r.moduleName,
          cascadedModules: r.cascadedModules,
          cascadedCases: r.cascadedCases
        })),
      failed: results
        .filter(r => !r.success)
        .map(r => ({
          id: idMapper.shorten(r.moduleId),
          error: r.error
        }))
    }

    return {
      success: true,
      data: summary,
      ztdl: ztdlParts.length > 0 ? ztdlParts.join('\n') : `-${deletedCount}ok`
    }
  }
}
