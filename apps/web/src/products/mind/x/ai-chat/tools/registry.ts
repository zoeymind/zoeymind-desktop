/**
 * 工具注册表 - V2
 *
 * 每个工具返回结构化数据
 */

import type MindMap from 'simple-mind-map'
import type { ExecutionResult, Tool } from './types'
import type { SessionIdMapper } from './session-id-mapper'
import { listModulesTool } from './mindmap/list-modules'
import { searchCasesTool } from './mindmap/search-cases'
import { getModuleCasesTool } from './mindmap/get-module-cases'
import { addCasesTool } from './mindmap/add-cases'
import { updateCasesTool } from './mindmap/update-cases'
import { deleteCasesTool } from './mindmap/delete-cases'
import { addModuleTool } from './mindmap/add_module'
import { updateModuleTool } from './mindmap/update_module'
import { deleteModuleTool } from './mindmap/delete_module'
import { ensureCasesTool } from './mindmap/ensure-cases'

const questionTool: Tool = {
  name: 'question',
  label: '向用户提问',
  description: '通过交互式 UI 向用户提问获取答案',
  parameters: {},
  config: {
    timeout: 999000
  },
  handler: async () => ({
    success: false,
    error: 'question 由 UI 渲染处理，不通过 handler 执行'
  })
}

// 工具定义（包含 handler 和 config）
const toolDefinitions: Record<string, Tool> = {
  list_modules: listModulesTool,
  search_cases: searchCasesTool,
  get_module_cases: getModuleCasesTool,
  add_cases: addCasesTool,
  update_cases: updateCasesTool,
  delete_cases: deleteCasesTool,
  add_module: addModuleTool,
  update_module: updateModuleTool,
  delete_module: deleteModuleTool,
  ensure_cases: ensureCasesTool,
  question: questionTool
}

export function getToolLabel(toolName: string) {
  return toolDefinitions[toolName]?.label
}

/**
 * 带超时的执行
 */
async function executeWithTimeout<T>(promise: Promise<T>, timeout: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('工具执行超时')), timeout))
  ])
}

export async function executeToolCall(
  toolName: string,
  args: Record<string, unknown>,
  mindMap: MindMap,
  idMapper: SessionIdMapper
): Promise<ExecutionResult> {
  const toolDef = toolDefinitions[toolName]
  if (!toolDef) {
    return {
      success: false,
      error: `工具 "${toolName}" 不存在`
    }
  }

  try {
    const timeout = toolDef.config?.timeout || 30000
    return await executeWithTimeout(toolDef.handler(args, { mindMap, idMapper }), timeout)
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }
  }
}
