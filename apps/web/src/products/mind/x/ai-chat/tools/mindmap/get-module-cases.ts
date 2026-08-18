import type { Tool, ExecutionResult } from '../../../ai-chat/tools/types'
import { findNodeByUid, type MindMapNodeTree } from './mindmap-node-tree'
import { extractPriorityFromIcons } from './priority-label'
import { compileModuleTree, type ShortenIdFn } from './ztdl-compiler'

// ─── UI 结构化数据 ───

interface TestCase {
  id: string
  case: string
  steps: string[]
}

type ModuleResult = {
  moduleId: string
  moduleName: string
  caseCount: number
  directCaseCount: number
  cases: TestCase[]
  subModules?: ModuleResult[]
  error?: string
}

function collectModuleInfo(moduleNodeData: MindMapNodeTree | null): ModuleResult {
  const moduleId = moduleNodeData?.data?.uid || ''
  const moduleName = moduleNodeData?.data?.text || '未知模块'

  const directCases: TestCase[] = []
  const aggregatedCases: TestCase[] = []
  const subModules: ModuleResult[] = []

  if (moduleNodeData?.children && Array.isArray(moduleNodeData.children)) {
    for (const childNode of moduleNodeData.children) {
      const childIcons = childNode.data?.icon || []
      const isSubModule = childIcons.includes('sign_2')
      const isCase = childIcons.some((icon: string) => icon.startsWith('priority_'))

      if (isSubModule) {
        const subModuleInfo = collectModuleInfo(childNode)
        subModules.push(subModuleInfo)
        aggregatedCases.push(...subModuleInfo.cases)
      } else if (isCase) {
        // 严格判断：只有带 priority_* 图标的才是用例（与 compileModuleTree 保持一致）
        const priority = extractPriorityFromIcons(childIcons)
        const childText = childNode.data?.text || '无标题用例'
        const caseWithPriority = `[P${priority}]${childText}`
        const steps =
          childNode.children
            ?.map((stepNode: MindMapNodeTree) => stepNode.data?.text || '')
            .filter(Boolean) || []

        directCases.push({
          id: childNode.data?.uid || '',
          case: caseWithPriority,
          steps
        })
      }
      // 既不是模块也不是用例的节点（无 sign_2 也无 priority_*）→ 忽略
    }
  }

  const allCases = [...directCases, ...aggregatedCases]
  return {
    moduleId,
    moduleName,
    caseCount: allCases.length,
    directCaseCount: directCases.length,
    cases: allCases,
    subModules: subModules.length > 0 ? subModules : undefined
  }
}

// ─── 工具定义 ───

export const getModuleCasesTool: Tool = {
  name: 'get_module_cases',
  label: '获取模块用例',
  description:
    '获取一个或多个模块的测试用例（ZTDL 格式）。返回模块及其直接用例，子模块会嵌套显示。',
  parameters: {
    moduleIds: {
      type: 'array',
      description: '模块节点ID数组',
      required: true
    }
  },
  handler: async (args, context): Promise<ExecutionResult> => {
    const { mindMap } = context
    const { moduleIds } = args as { moduleIds: string[] }

    if (!mindMap) {
      return { success: false, error: '思维导图实例不存在' }
    }

    if (!Array.isArray(moduleIds) || moduleIds.length === 0) {
      return { success: false, error: 'moduleIds 必须是非空数组' }
    }

    const { idMapper } = context
    const results: ModuleResult[] = []
    const ztdlLines: string[] = []
    const shortenId: ShortenIdFn = uuid => idMapper.shorten(uuid)

    for (const moduleId of moduleIds) {
      try {
        const moduleNodeData = findNodeByUid(mindMap, moduleId)
        const shortId = idMapper.shorten(moduleId)

        if (!moduleNodeData) {
          results.push({
            moduleId,
            moduleName: '',
            caseCount: 0,
            directCaseCount: 0,
            cases: [],
            error: `未找到模块ID: ${shortId}`
          })
          ztdlLines.push(`# ERR: ${shortId} not found`)
          continue
        }

        results.push(collectModuleInfo(moduleNodeData))
        ztdlLines.push(...compileModuleTree(moduleNodeData, 0, shortenId))
      } catch (error) {
        const errShort = idMapper.shorten(moduleId)
        results.push({
          moduleId,
          moduleName: '',
          caseCount: 0,
          directCaseCount: 0,
          cases: [],
          error: `处理模块失败: ${error instanceof Error ? error.message : String(error)}`
        })
        ztdlLines.push(
          `# ERR: ${errShort} ${error instanceof Error ? error.message : String(error)}`
        )
      }
    }

    const successCount = results.filter(r => !r.error).length
    const totalCases = results.reduce((sum, r) => sum + r.caseCount, 0)

    return {
      success: true,
      data: {
        totalModules: moduleIds.length,
        successCount,
        totalCases,
        results
      },
      ztdl: ztdlLines.join('\n')
    }
  }
}
