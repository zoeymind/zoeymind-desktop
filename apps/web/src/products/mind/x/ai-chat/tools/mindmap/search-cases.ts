// @ts-nocheck — desktop mirror of cloud AI chat; runtime bridged via bridge.tsx
import type { Tool, ExecutionResult } from '../../../ai-chat/tools/types'
import type { MindMapNodeTree } from './mindmap-node-tree'
import { extractPriorityFromIcons, type Priority } from './priority-label'
import { getMindMapSnapshot } from './mindmap-node-tree'
import { compileSearchHit } from './ztdl-compiler'

export const searchCasesTool: Tool = {
  name: 'search_cases',
  label: '搜索用例',
  description: '在思维导图中跨模块搜索测试用例（ZTDL 格式）',
  parameters: {
    query: {
      type: 'string',
      description: '用例名称关键词（支持模糊匹配）',
      required: true
    },
    limit: {
      type: 'number',
      description: '返回结果的最大数量',
      required: false,
      default: 20
    }
  },
  handler: async (args, context): Promise<ExecutionResult> => {
    const { mindMap } = context
    const query = args.query as string
    const limit = (args.limit as number) ?? 20

    if (!mindMap) {
      return { success: false, error: '思维导图实例不存在' }
    }

    try {
      // UI 结构化数据
      const cases: Array<{
        caseId: string
        caseName: string
        moduleId: string
        moduleName: string
        steps: string[]
        priority?: Priority
      }> = []

      // ZTDL 文本
      const ztdlLines: string[] = []
      const queryLower = query.toLowerCase()

      const allData = getMindMapSnapshot(mindMap)
      if (!allData) {
        return {
          success: true,
          data: { query, count: 0, cases: [] },
          ztdl: `# search "${query}"\n(no results)`
        }
      }

      // 遍历时传递最近的模块祖先（sign_2 图标），只匹配用例节点（priority_* 图标）
      const traverse = (node: MindMapNodeTree, closestModule?: MindMapNodeTree) => {
        if (cases.length >= limit) return

        const icons = node.data?.icon || []
        const isModule = icons.includes('sign_2')
        const isCase = icons.some((icon: string) => icon.startsWith('priority_'))

        // 更新最近的模块祖先
        const currentModule = isModule ? node : closestModule

        // 只搜索用例节点（有 priority_* 图标），跳过模块和步骤
        if (isCase) {
          const text = node.data?.text || ''
          if (text.toLowerCase().includes(queryLower)) {
            const moduleId = currentModule?.data?.uid || ''
            const moduleName = currentModule?.data?.text || '未知模块'
            const caseId = node.data?.uid || ''
            const priority = extractPriorityFromIcons(icons)
            const steps =
              node.children?.map(stepNode => stepNode.data?.text || '').filter(Boolean) || []

            cases.push({ caseId, caseName: text, moduleId, moduleName, steps, priority })

            const { idMapper } = context
            const caseShort = idMapper.shorten(caseId)
            const moduleShort = moduleId ? idMapper.shorten(moduleId) : ''
            ztdlLines.push(
              ...compileSearchHit(caseShort, text, priority, steps, moduleShort, moduleName)
            )
          }
          // 用例的子节点是步骤，不需要继续递归搜索
          return
        }

        // 模块或根节点：继续递归子节点
        if (node.children && Array.isArray(node.children)) {
          node.children.forEach(child => traverse(child, currentModule))
        }
      }

      traverse(allData, undefined)

      return {
        success: true,
        data: { query, count: cases.length, cases },
        ztdl: `# search "${query}" (${cases.length})\n${ztdlLines.length > 0 ? ztdlLines.join('\n') : '(no results)'}`
      }
    } catch (error) {
      return {
        success: false,
        error: `搜索用例失败: ${error instanceof Error ? error.message : String(error)}`
      }
    }
  }
}
