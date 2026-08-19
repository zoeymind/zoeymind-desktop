// @ts-nocheck — desktop mirror of cloud AI chat; runtime bridged via bridge.tsx
import type { Tool, ExecutionResult } from '../../../ai-chat/tools/types'
import type { MindMapNodeTree } from './mindmap-node-tree'
import { getMindMapSnapshot } from './mindmap-node-tree'
import { compileModuleList, type ShortenIdFn } from './ztdl-compiler'

// ─── UI 结构化数据（保持原有 UI 渲染所需结构） ───

interface NestedModule {
  id: string
  name: string
  caseCount: number
  /** 父模块 ID（短 ID），根模块为 null */
  parentId: string | null
  /** 层级深度，根模块为 0 */
  depth: number
  children: NestedModule[]
}

function buildNestedStructure(
  node: MindMapNodeTree,
  depth: number = 0,
  parentId: string | null = null,
  idMapper?: { shorten: (uuid: string) => string }
): NestedModule[] {
  const modules: NestedModule[] = []
  if (!node.children || !Array.isArray(node.children)) return modules

  for (const child of node.children) {
    const text = child.data?.text || ''
    const icons = child.data?.icon || []
    if (!icons.includes('sign_2')) continue

    const childUid = child.data?.uid || ''
    const childShortId = idMapper ? idMapper.shorten(childUid) : childUid

    let caseCount = 0
    if (child.children && Array.isArray(child.children)) {
      caseCount = child.children.filter(c => !(c.data?.icon || []).includes('sign_2')).length
    }

    modules.push({
      id: childShortId,
      name: text,
      caseCount,
      parentId,
      depth,
      children: buildNestedStructure(child, depth + 1, childShortId, idMapper)
    })
  }
  return modules
}

function countModules(modules: NestedModule[]): number {
  return modules.reduce((sum, m) => sum + 1 + countModules(m.children), 0)
}

/**
 * 列出所有测试模块工具
 *
 * data: 结构化数据（供 UI 渲染，含 parentId 和 depth）
 * ztdl: ZTDL 格式文本（供 AI 消费，由统一编译器生成）
 */
export const listModulesTool: Tool = {
  name: 'list_modules',
  label: '列出模块',
  description:
    '列出思维导图中所有的测试模块节点（ZTDL 格式，括号内为直接用例数量）。返回结果包含层级关系（parentId、depth）。',
  parameters: {},
  handler: async (_args, context): Promise<ExecutionResult> => {
    const { mindMap, idMapper } = context

    if (!mindMap) {
      return { success: false, error: '思维导图实例不存在' }
    }

    try {
      const allData = getMindMapSnapshot(mindMap)
      if (!allData) {
        return { success: true, data: { totalCount: 0, modules: [] }, ztdl: '(empty)' }
      }

      // UI 数据（含层级关系）
      const modules = buildNestedStructure(allData, 0, null, idMapper)
      const totalCount = countModules(modules)

      // ZTDL（调用统一编译器，直接传入短 ID 转换回调）
      const shortenId: ShortenIdFn = uuid => idMapper.shorten(uuid)
      const ztdlLines = compileModuleList(allData, 0, shortenId)

      return {
        success: true,
        data: { totalCount, modules },
        ztdl: ztdlLines.length > 0 ? ztdlLines.join('\n') : '(no modules)'
      }
    } catch (error) {
      return {
        success: false,
        error: `列出模块失败: ${error instanceof Error ? error.message : String(error)}`
      }
    }
  }
}
