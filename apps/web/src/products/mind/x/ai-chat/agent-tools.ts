// @ts-nocheck — desktop mirror of cloud AI chat; runtime bridged via bridge.tsx
/**
 * 桌面端 agent 工具集 —— 精简自 apps/zoeymind/x/api/services/ai-v2/tools.ts.
 * 结构完全一致 (AI SDK `tool({description, inputSchema, ...})`), 只做用例/模块 CRUD
 * + question, 不含 figma / MCP (那些 provider 要后端上下文, 桌面端未实装).
 */

import { tool } from 'ai'
import {
  ListModulesSchema,
  GetModuleCasesSchema,
  SearchCasesSchema,
  AddModuleSchema,
  AddCasesSchema,
  UpdateModuleSchema,
  UpdateCasesSchema,
  DeleteModuleSchema,
  DeleteCasesSchema,
  EnsureCasesSchema,
  QuestionSchema
} from '@zoeymind/shared'

export function getAgentTools() {
  return {
    list_modules: tool({
      description: '列出所有测试模块的基本信息（名称和ID）',
      inputSchema: ListModulesSchema
    }),

    get_module_cases: tool({
      description:
        '获取一个或多个模块的测试用例。只返回模块下直接的测试用例，不包含子模块的用例',
      inputSchema: GetModuleCasesSchema
    }),

    search_cases: tool({
      description: '在思维导图中跨模块搜索测试用例（支持模糊匹配）',
      inputSchema: SearchCasesSchema
    }),

    add_module: tool({
      description:
        '在指定父模块下批量添加同层级子模块。支持预分配 ID（modules[].id），后续调用可直接引用。\n\n规则：\n1. 每次调用只创建同一父节点下的一层子模块\n2. 要创建多层嵌套需分多次调用\n3. 若父模块下已有用例，不能再添加子模块（模块和用例不能混放）\n4. 不指定 parentModuleId 时添加到根节点',
      inputSchema: AddModuleSchema
    }),

    add_cases: tool({
      description:
        '批量添加测试用例到指定模块（仅叶子模块）。\n\n规则：\n1. 目标模块下若已有子模块，不能添加用例\n2. case 必须以 [P1]/[P2]/[P3] 开头，可追加 " & 前置条件"\n3. steps 每一项必须包含 "&"，格式为 "操作 & 预期结果"',
      inputSchema: AddCasesSchema
    }),

    update_module: tool({
      description:
        '批量更新测试模块信息（名称、描述等）。**建议一次性更新所有需要修改的模块**，而不是逐个更新，可以提高效率。',
      inputSchema: UpdateModuleSchema
    }),

    update_cases: tool({
      description:
        '批量更新测试用例信息（名称、步骤等），建议一次性提交所有变更。\n\n规则：\n1. case 字段（如提供）必须以 [P1]/[P2]/[P3] 开头\n2. steps 字段（如提供）每一项必须包含 "&"，格式为 "操作 & 预期结果"',
      inputSchema: UpdateCasesSchema
    }),

    delete_module: tool({
      description:
        '批量删除测试模块。**建议一次性删除所有需要删除的模块**，而不是逐个删除，可以提高效率。注意：删除模块会同时删除其下的所有子模块和用例',
      inputSchema: DeleteModuleSchema
    }),

    delete_cases: tool({
      description:
        '批量删除测试用例。**建议一次性删除所有需要删除的用例**，而不是逐个删除，可以提高效率。',
      inputSchema: DeleteCasesSchema
    }),

    ensure_cases: tool({
      description:
        '确保指定模块下存在目标用例：按用例名称匹配，存在则更新，不存在则创建。优先用于同步同名用例，避免重复新增。',
      inputSchema: EnsureCasesSchema
    }),

    question: tool({
      description:
        '向用户发起结构化提问获取答案。使用批量问题（推荐）: {questions: [{header, question, options?, multiple?}], allowSkip?}. options 存在则为选择题, 不存在为文本输入题.',
      inputSchema: QuestionSchema
    })
  }
}
