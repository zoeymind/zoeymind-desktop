// @ts-nocheck — dormant AI chat / MCP module (bridge.tsx flattens to no-op)
import { EnsureCasesSchema } from '@zoeymind/shared'
import type { Tool, ExecutionResult } from '../../../ai-chat/tools/types'
import { findNodeByUid, type MindMapNodeTree } from './mindmap-node-tree'
import { createPriorityIcons, parsePriorityFromText } from './priority-label'
import { createUUID } from '@/shared/app-shared'

/**
 * 确保用例存在工具（upsert 能力）
 *
 * 按用例名称匹配：
 * - 存在 → 更新步骤和优先级
 * - 不存在 → 创建新用例
 *
 * 适合"更新或新增"场景，无需先查询再决定调用哪个接口。
 */
export const ensureCasesTool: Tool = {
  name: 'ensure_cases',
  label: '确保用例存在',
  description:
    '确保指定模块下存在指定名称的用例。按用例名称匹配：存在则更新步骤和优先级，不存在则创建。适合批量同步用例，无需先查询。',
  parameters: {
    moduleId: {
      type: 'string',
      description: '目标模块ID',
      required: true
    },
    cases: {
      type: 'array',
      description: '用例列表（按名称匹配）',
      required: true
    }
  },
  handler: async (args, context): Promise<ExecutionResult> => {
    const parseResult = EnsureCasesSchema.safeParse(args)
    if (!parseResult.success) {
      const firstError = parseResult.error.issues[0]
      return {
        success: false,
        error:
          firstError.message +
          (firstError.path.length > 0 ? ` (路径: ${firstError.path.join('.')})` : '')
      }
    }

    const { moduleId, cases } = parseResult.data
    const { mindMap, idMapper } = context

    if (!mindMap) {
      return { success: false, error: '思维导图实例不存在' }
    }

    // 查找目标模块
    const moduleNode = findNodeByUid(mindMap, moduleId)
    if (!moduleNode) {
      const shortId = idMapper.shorten(moduleId)
      return { success: false, error: `模块 ${shortId} 不存在` }
    }

    // 检查模块是否有子模块（不能混放）
    const childModules = (moduleNode.children || []).filter(child => {
      const icons = child.data?.icon || []
      return icons.includes('sign_2')
    })
    if (childModules.length > 0) {
      const shortId = idMapper.shorten(moduleId)
      return {
        success: false,
        error: `模块 ${shortId} 下有 ${childModules.length} 个子模块，不能再添加用例。请选择叶子模块。`
      }
    }

    const moduleShortId = idMapper.shorten(moduleId)
    const ztdlLines: string[] = []
    const results: Array<{
      name: string
      action: 'created' | 'updated'
      caseId: string
    }> = []

    // 构建现有用例索引（名称 → 节点）
    const existingCases = new Map<string, MindMapNodeTree>()
    for (const child of moduleNode.children || []) {
      const text = (child.data?.text || '').replace(/\[P[1-3]\]\s*/g, '').trim()
      if (text) {
        existingCases.set(text, child)
      }
    }

    // 处理每个用例
    for (const testCase of cases) {
      const { priority, cleanText } = parsePriorityFromText(testCase.case)
      const caseName = cleanText.trim()
      if (!caseName) {
        return {
          success: false,
          error: `用例 "${testCase.case}" 缺少名称，格式应为 [P1/P2/P3]用例名称`
        }
      }

      const finalPriority = priority || 2
      const steps = testCase.steps || []
      const existingNode = existingCases.get(caseName)

      if (existingNode) {
        // 更新已存在的用例
        const caseUid = existingNode.data?.uid || ''
        const caseShortId = idMapper.shorten(caseUid)
        const priorityNum = finalPriority as 1 | 2 | 3

        // 更新优先级图标
        existingNode.data = existingNode.data || {}
        existingNode.data.icon = createPriorityIcons(priorityNum)
        existingNode.data.text = `[P${finalPriority}]${caseName}`

        // 更新步骤
        existingNode.children = steps.map(step => ({
          data: { text: step, uid: createUUID() },
          children: []
        }))

        ztdlLines.push(`~C:${caseShortId} [P${finalPriority}]${caseName}`)
        results.push({ name: caseName, action: 'updated', caseId: caseUid })
      } else {
        // 创建新用例
        const newUid = createUUID()
        const newShortId = idMapper.shorten(newUid)
        const priorityNum = finalPriority as 1 | 2 | 3

        const newNode: MindMapNodeTree = {
          data: {
            text: `[P${finalPriority}]${caseName}`,
            icon: createPriorityIcons(priorityNum),
            uid: newUid
          },
          children: steps.map(step => ({
            data: { text: step, uid: createUUID() },
            children: []
          }))
        }

        if (!moduleNode.children) {
          moduleNode.children = []
        }
        moduleNode.children.push(newNode)

        ztdlLines.push(`+C:${newShortId} [P${finalPriority}]${caseName} > M:${moduleShortId}`)
        results.push({ name: caseName, action: 'created', caseId: newUid })
      }
    }

    // 更新思维导图
    try {
      mindMap.updateData(mindMap.getData())
    } catch (error) {
      return {
        success: false,
        error: `更新思维导图失败: ${error instanceof Error ? error.message : String(error)}`
      }
    }

    const createdCount = results.filter(r => r.action === 'created').length
    const updatedCount = results.filter(r => r.action === 'updated').length
    const header = `ensure: ${createdCount}新增/${updatedCount}更新`

    return {
      success: true,
      data: {
        moduleId,
        moduleName: moduleNode.data?.text || '',
        results,
        createdCount,
        updatedCount
      },
      ztdl: `${header}\n${ztdlLines.join('\n')}`
    }
  }
}