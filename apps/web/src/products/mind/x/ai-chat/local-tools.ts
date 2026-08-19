// @ts-nocheck — desktop mirror of cloud AI chat; runtime bridged via bridge.tsx
/**
 * 桌面端 AI 工具静态清单 —— 来源: apps/zoeymind/x/api/services/ai-v2/tools.ts.
 * 桌面端后端不跑 trpc.aiV2.getTools, 用这个静态常量做本地 shim.
 *
 * name + label + description 三字段跟源保持一致 (源 getTools 返回也就这三个字段).
 */

export interface LocalAIToolInfo {
  name: string
  label?: string
  description?: string
  enabled?: boolean
}

export const LOCAL_AI_TOOLS: LocalAIToolInfo[] = [
  {
    name: 'list_modules',
    label: '列出模块',
    description: '列出所有测试模块的基本信息（名称和ID）'
  },
  {
    name: 'get_module_cases',
    label: '获取模块用例',
    description:
      '获取一个或多个模块的测试用例。只返回模块下直接的测试用例，不包含子模块的用例'
  },
  {
    name: 'search_cases',
    label: '搜索用例',
    description: '在思维导图中跨模块搜索测试用例（支持模糊匹配）'
  },
  {
    name: 'add_module',
    label: '添加模块',
    description:
      '在指定父模块下批量添加同层级子模块。支持预分配 ID（modules[].id），后续调用可直接引用。\n\n规则：\n1. 每次调用只创建同一父节点下的一层子模块\n2. 要创建多层嵌套需分多次调用\n3. 若父模块下已有用例，不能再添加子模块（模块和用例不能混放）\n4. 不指定 parentModuleId 时添加到根节点'
  },
  {
    name: 'add_cases',
    label: '添加用例',
    description:
      '批量添加测试用例到指定模块（仅叶子模块）。\n\n规则：\n1. 目标模块下若已有子模块，不能添加用例\n2. case 必须以 [P1]/[P2]/[P3] 开头，可追加 " & 前置条件"\n3. steps 每一项必须包含 "&"，格式为 "操作 & 预期结果"'
  },
  {
    name: 'update_module',
    label: '更新模块',
    description:
      '批量更新测试模块信息（名称、描述等）。**建议一次性更新所有需要修改的模块**，而不是逐个更新，可以提高效率。'
  },
  {
    name: 'update_cases',
    label: '更新用例',
    description:
      '批量更新测试用例信息（名称、步骤等），建议一次性提交所有变更。\n\n规则：\n1. case 字段（如提供）必须以 [P1]/[P2]/[P3] 开头\n2. steps 字段（如提供）每一项必须包含 "&"，格式为 "操作 & 预期结果"'
  },
  {
    name: 'delete_module',
    label: '删除模块',
    description:
      '批量删除测试模块。**建议一次性删除所有需要删除的模块**，而不是逐个删除，可以提高效率。注意：删除模块会同时删除其下的所有子模块和用例'
  },
  {
    name: 'delete_cases',
    label: '删除用例',
    description:
      '批量删除测试用例。**建议一次性删除所有需要删除的用例**，而不是逐个删除，可以提高效率。'
  },
  {
    name: 'ensure_cases',
    label: '确保用例存在',
    description:
      '确保指定模块下存在目标用例：按用例名称匹配，存在则更新，不存在则创建。优先用于同步同名用例，避免重复新增。'
  },
  {
    name: 'question',
    label: '向用户提问',
    description: '向用户发起结构化提问（单选 / 多选 / 文本），澄清需求.'
  }
]
