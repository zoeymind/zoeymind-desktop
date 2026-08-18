/**
 * AI 工具 Schema 定义（前后端共享）
 *
 * 使用 Zod 定义，确保前后端类型一致
 */

import { z } from 'zod'

function parseJsonString(value: unknown): unknown {
  if (typeof value !== 'string') return value

  const trimmed = value.trim()
  if (!trimmed) return value

  try {
    return JSON.parse(trimmed)
  } catch {
    return value
  }
}

function parseBooleanString(value: unknown): unknown {
  if (typeof value !== 'string') return value

  const normalized = value.trim().toLowerCase()
  if (normalized === 'true') return true
  if (normalized === 'false') return false

  return value
}

const QuestionItemSchema = z.object({
  header: z
    .string({
      error: 'header 必须是字符串'
    })
    .max(30, 'header 不能超过 30 个字符')
    .optional()
    .describe('问题标题/分类（可选，用于 Tab 显示，最长30字符）'),
  question: z
    .string({
      error: 'question 必须是字符串'
    })
    .min(1, 'question 不能为空')
    .describe('问题文本（完整的问题）'),
  options: z
    .array(
      z.object({
        label: z
          .string({
            error: 'label 必须是字符串'
          })
          .min(1, 'label 不能为空')
          .max(50, 'label 不能超过 50 个字符')
          .describe('选项文本（1-5个词，简短）'),
        description: z
          .string({
            error: 'description 必须是字符串'
          })
          .optional()
          .describe('选项说明')
      }),
      {
        error: 'options 必须是对象数组'
      }
    )
    .optional()
    .describe('选项列表（单选/多选需要）'),
  multiple: z
    .boolean({
      error: 'multiple 必须是布尔值'
    })
    .default(false)
    .describe('是否允许多选（默认 false，单选）'),
  placeholder: z
    .string({
      error: 'placeholder 必须是字符串'
    })
    .optional()
    .describe('文本输入占位符（可选，文本输入时使用）')
})

const QuestionsArraySchema = z
  .array(QuestionItemSchema, {
    error: 'questions 必须是数组'
  })
  .min(1, 'questions 至少包含一个问题')
  .describe('问题列表（可批量提交多个问题）')

/**
 * 1. list_modules - 列出所有模块
 */
export const ListModulesSchema = z.object({})

/**
 * 2. get_module_cases - 获取模块下的用例
 */
export const GetModuleCasesSchema = z.object({
  moduleIds: z
    .array(z.string(), {
      error: 'moduleIds 必须是数组'
    })
    .min(1, 'moduleIds 数组不能为空')
})

/**
 * 3. search_cases - 搜索用例
 */
export const SearchCasesSchema = z.object({
  query: z.string({
    error: 'query 必须是字符串'
  }),
  limit: z
    .number({
      error: 'limit 必须是数字'
    })
    .optional()
})

/**
 * 4. add_module - 添加模块
 */
export const AddModuleSchema = z.object({
  parentModuleId: z
    .string({
      error: 'parentModuleId 必须是字符串'
    })
    .optional(),
  modules: z
    .array(
      z.object({
        name: z.string({
          error: 'name 必须是字符串'
        }),
        id: z.string({ error: 'id 必须是字符串' }).optional()
      }),
      {
        error: 'modules 必须是数组'
      }
    )
    .min(1, 'modules 数组不能为空')
})

/**
 * 5. add_cases - 添加用例
 */
export const AddCasesSchema = z.object({
  moduleId: z
    .string({
      error: 'moduleId 必须是字符串'
    })
    .min(1, 'moduleId 不能为空'),
  cases: z
    .array(
      z.object({
        case: z
          .string({
            error: 'case 必须是字符串'
          })
          .refine(val => /^\[P[1-3]\]/.test(val), {
            message:
              'case 必须以优先级前缀开头：[P1]、[P2] 或 [P3]，例如："[P1]登录-手机号验证 & 未登录"'
          }),
        steps: z
          .array(
            z
              .string({
                error: 'steps 数组的每一项必须是字符串，格式必须为 "操作步骤 & 预期结果"'
              })
              .refine(val => val.includes('&'), {
                message:
                  '每个步骤必须包含 "&" 符号来分隔操作和预期结果，例如："点击按钮 & 这个操作成功"'
              }),
            {
              error: 'steps 必须是数组'
            }
          )
          .min(1, '每个用例必须包含至少一个步骤'),
        id: z.string({ error: 'id 必须是字符串' }).optional()
      }),
      {
        error: 'cases 必须是数组'
      }
    )
    .min(1, 'cases 数组不能为空')
})

/**
 * 6. update_module - 更新模块
 */
export const UpdateModuleSchema = z.object({
  updates: z
    .array(
      z.object({
        moduleId: z
          .string({
            error: 'moduleId 必须是字符串'
          })
          .min(1, 'moduleId 不能为空'),
        name: z
          .string({
            error: 'name 必须是字符串'
          })
          .optional(),
        description: z
          .string({
            error: 'description 必须是字符串'
          })
          .optional()
      }),
      {
        error: 'updates 必须是数组'
      }
    )
    .min(1, 'updates 数组不能为空')
})

/**
 * 7. update_cases - 更新用例
 */
export const UpdateCasesSchema = z.object({
  updates: z
    .array(
      z.object({
        caseId: z
          .string({
            error: 'caseId 必须是字符串'
          })
          .min(1, 'caseId 不能为空'),
        case: z
          .string({
            error: 'case 必须是字符串'
          })
          .refine(val => /^\[P[1-3]\]/.test(val), {
            message: 'case 必须以优先级前缀开头：[P1]、[P2] 或 [P3]，例如："[P1]登录-手机号验证"'
          })
          .optional(),
        steps: z
          .array(
            z
              .string({
                error: 'steps 数组的每一项必须是字符串，格式必须为 "操作步骤 & 预期结果"'
              })
              .refine(val => val.includes('&'), {
                message:
                  '每个步骤必须包含 "&" 符号来分隔操作和预期结果，例如："点击按钮 & 这个操作成功"'
              }),
            {
              error: 'steps 必须是数组'
            }
          )
          .optional()
      }),
      {
        error: 'updates 必须是数组'
      }
    )
    .min(1, 'updates 数组不能为空')
})

/**
 * 8. delete_module - 删除模块
 */
export const DeleteModuleSchema = z.object({
  moduleIds: z
    .array(z.string(), {
      error: 'moduleIds 必须是数组'
    })
    .min(1, 'moduleIds 数组不能为空')
})

/**
 * 9. delete_cases - 删除用例
 */
export const DeleteCasesSchema = z.object({
  caseIds: z
    .array(z.string(), {
      error: 'caseIds 必须是数组'
    })
    .min(1, 'caseIds 数组不能为空')
})

/**
 * 10. ensure_cases - 确保用例存在（upsert 能力）
 *
 * 按用例名称匹配：存在则更新步骤，不存在则创建。
 * 适合"更新或新增"场景，无需先查询再决定调用哪个接口。
 */
export const EnsureCasesSchema = z.object({
  moduleId: z
    .string({
      error: 'moduleId 必须是字符串'
    })
    .min(1, 'moduleId 不能为空'),
  cases: z
    .array(
      z.object({
        case: z
          .string({
            error: 'case 必须是字符串'
          })
          .refine(val => /^\[P[1-3]\]/.test(val), {
            message:
              'case 必须以优先级前缀开头：[P1]、[P2] 或 [P3]，例如："[P1]登录-手机号验证 & 未登录"'
          })
          .describe('用例文本，格式：[P1/P2/P3]用例名称 & 前置条件（前置条件可选）'),
        steps: z
          .array(
            z
              .string({
                error: 'steps 数组的每一项必须是字符串'
              })
              .refine(val => val.includes('&'), {
                message:
                  '每个步骤必须包含 "&" 符号来分隔操作和预期结果，例如："输入手机号 & 点击登录"'
              }),
            {
              error: 'steps 必须是数组'
            }
          )
          .min(1, '每个用例必须包含至少一个步骤')
      }),
      {
        error: 'cases 必须是数组'
      }
    )
    .min(1, 'cases 数组不能为空')
})

/**
 * 11. read_feishu_document - 读取飞书文档
 */
export const ReadFeishuDocumentSchema = z.object({
  url: z
    .string({
      error: 'url 必须是字符串'
    })
    .url('url 必须是有效的链接地址')
    .refine(
      url => {
        try {
          const urlObj = new URL(url)
          return urlObj.hostname.includes('feishu.cn') || urlObj.hostname.includes('larkoffice.com')
        } catch {
          return false
        }
      },
      { message: 'url 必须是飞书文档链接' }
    )
})

/**
 * 11. search_feishu_documents - 搜索可访问的飞书文档
 */
export const SearchFeishuDocumentSchema = z.object({
  keyword: z
    .string({
      error: 'keyword 必须是字符串'
    })
    .max(200, '搜索关键词过长')
    .default(''),
  limit: z
    .number({
      error: 'limit 必须是数字'
    })
    .int('limit 必须是整数')
    .min(1, 'limit 不能小于 1')
    .max(20, 'limit 不能超过 20')
    .optional()
})

/**
 * 12. query_knowledge_bases - 查询当前选择的数据库（知识库）内容
 */
export const QueryKnowledgeBasesSchema = z.object({
  query: z
    .string({
      error: 'query 必须是字符串'
    })
    .min(1, 'query 不能为空')
    .describe('查询文本，用于语义搜索知识库内容')
})

/**
 * 13. question - 向用户提问（支持批量问题）
 *
 * 使用简化的参数向用户提问，支持一次性提交多个问题。
 * 用户可以在问题之间切换 Tab，然后一次性提交所有答案。
 *
 * ⚠️ 使用规则：
 * - 最后总结不能存在疑问句，必须使用 question 工具提问
 * - 禁止在文本总结中提问，必须调用此工具
 */
export const QuestionSchema = z.object({
  questions: z.preprocess(parseJsonString, QuestionsArraySchema),
  allowSkip: z
    .preprocess(
      parseBooleanString,
      z.boolean({
        error: 'allowSkip 必须是布尔值'
      })
    )
    .default(false)
    .describe('是否显示跳过按钮（默认 false）')
})

/**
 * 14. web_search - 网络搜索
 */
export const WebSearchSchema = z.object({
  query: z
    .string({
      error: 'query 必须是字符串'
    })
    .min(1, 'query 不能为空')
    .describe('网络搜索查询关键词'),
  numResults: z
    .number({
      error: 'numResults 必须是数字'
    })
    .int('numResults 必须是整数')
    .min(1, 'numResults 不能小于 1')
    .max(20, 'numResults 不能超过 20')
    .optional()
    .describe('返回的搜索结果数量（默认：8）'),
  livecrawl: z
    .enum(['fallback', 'preferred'], {
      error: 'livecrawl 必须是 fallback 或 preferred'
    })
    .optional()
    .describe(
      "实时爬取模式 - 'fallback': 缓存不可用时使用实时爬取作为备份，'preferred': 优先使用实时爬取（默认：'fallback'）"
    ),
  type: z
    .enum(['auto', 'fast', 'deep'], {
      error: 'type 必须是 auto、fast 或 deep'
    })
    .optional()
    .describe("搜索类型 - 'auto': 平衡搜索（默认），'fast': 快速结果，'deep': 深度搜索"),
  contextMaxCharacters: z
    .number({
      error: 'contextMaxCharacters 必须是数字'
    })
    .int('contextMaxCharacters 必须是整数')
    .min(100, 'contextMaxCharacters 不能小于 100')
    .max(50000, 'contextMaxCharacters 不能超过 50000')
    .optional()
    .describe('为 LLM 优化的上下文字符串的最大字符数（默认：10000）')
})

/**
 * 15. web_fetch - 获取网页内容
 */
export const WebFetchSchema = z.object({
  url: z
    .string({
      error: 'url 必须是字符串'
    })
    .min(1, 'url 不能为空')
    .describe('要获取内容的网页链接'),
  format: z
    .enum(['text', 'markdown', 'html'], {
      error: 'format 必须是 text、markdown 或 html'
    })
    .default('markdown')
    .describe('返回内容的格式（text、markdown 或 html），默认为 markdown'),
  timeout: z
    .number({
      error: 'timeout 必须是数字'
    })
    .int('timeout 必须是整数')
    .min(1, 'timeout 不能小于 1')
    .max(120, 'timeout 不能超过 120 秒')
    .optional()
    .describe('可选的超时时间（秒），最大 120 秒')
})

/**
 * Figma 设计数据获取 Schema
 */
export const GetFigmaDataSchema = z.object({
  url: z
    .string({ error: 'url 必须是字符串' })
    .min(1, 'url 不能为空')
    .describe('Figma 文件 / frame / 节点链接（从 Figma 复制的 URL，含 file key 和可选 node-id）'),
  depth: z
    .number({ error: 'depth 必须是数字' })
    .int('depth 必须是整数')
    .min(1, 'depth 不能小于 1')
    .max(10, 'depth 不能超过 10')
    .optional()
    .describe('可选，遍历节点树的最大深度，控制返回数据量；不填用保守默认（避免上下文过大）')
})

/**
 * get_figma_metadata：返回稀疏骨架（页面 / frame 目录），用于超大设计先看结构再下钻
 */
export const GetFigmaMetadataSchema = z.object({
  url: z
    .string({ error: 'url 必须是字符串' })
    .min(1, 'url 不能为空')
    .describe(
      'Figma 文件 / frame 链接。不带 node-id 时返回页面与顶层 frame 目录，便于先选 frame 再下钻'
    )
})

/**
 * get_figma_image：返回某 frame/节点的渲染图 URL，供 AI 视觉理解界面
 */
export const GetFigmaImageSchema = z.object({
  url: z
    .string({ error: 'url 必须是字符串' })
    .min(1, 'url 不能为空')
    .describe('Figma frame / 节点链接（必须带 node-id，截图针对具体节点）'),
  format: z.enum(['png', 'svg']).optional().describe('图片格式，默认 png'),
  scale: z.number().min(0.5).max(4).optional().describe('渲染缩放，默认 2')
})

/**
 * 工具 Schema 映射表
 */
export const ToolSchemas = {
  list_modules: ListModulesSchema,
  get_module_cases: GetModuleCasesSchema,
  search_cases: SearchCasesSchema,
  add_module: AddModuleSchema,
  add_cases: AddCasesSchema,
  update_module: UpdateModuleSchema,
  update_cases: UpdateCasesSchema,
  delete_module: DeleteModuleSchema,
  delete_cases: DeleteCasesSchema,
  ensure_cases: EnsureCasesSchema,
  read_feishu_document: ReadFeishuDocumentSchema,
  search_feishu_documents: SearchFeishuDocumentSchema,
  query_knowledge_bases: QueryKnowledgeBasesSchema,
  question: QuestionSchema,
  web_search: WebSearchSchema,
  web_fetch: WebFetchSchema,
  get_figma_data: GetFigmaDataSchema,
  get_figma_metadata: GetFigmaMetadataSchema,
  get_figma_image: GetFigmaImageSchema
} as const

/**
 * 工具名称类型
 */
export type ToolName = keyof typeof ToolSchemas

/**
 * 工具参数类型推导
 */
export type ToolArgs<T extends ToolName> = z.infer<(typeof ToolSchemas)[T]>

/**
 * 用户可在设置面板中开关的工具白名单。
 *
 * 只有"锦上添花"类的工具放进来（网络搜索、网页抓取、Figma 设计稿读取）。
 * 思维导图 CRUD（add_module / add_cases 等）与 question 这类核心链路工具
 * 不可关闭——关掉它们 AI 就没法生成/维护用例了，因此不纳入白名单。
 *
 * 说明：query_knowledge_bases 与飞书文档工具当前未在后端注册（见 services/ai-v2/tools.ts），
 * 故也不纳入用户可开关的白名单，避免暴露不可用的开关。
 */
export const TOGGLEABLE_TOOL_NAMES = [
  'web_search',
  'web_fetch',
  'get_figma_metadata',
  'get_figma_data',
  'get_figma_image'
] as const satisfies readonly ToolName[]

export type ToggleableToolName = (typeof TOGGLEABLE_TOOL_NAMES)[number]

/**
 * 可开关工具的默认启用状态。
 *
 * 默认全部启用，保持与"未引入开关前"的行为一致（老用户无感知）。
 * Figma 工具虽在默认列表里，但后端仍会按用户是否配置 Figma token 二次过滤，
 * 未配置的用户即便开关为 on 也不会真正注册（见 getTestCaseTools 的 figmaEnabled）。
 */
export const DEFAULT_ENABLED_TOOL_NAMES: readonly ToggleableToolName[] = [...TOGGLEABLE_TOOL_NAMES]

/** 判断某个工具名是否属于用户可开关的白名单。 */
export function isToggleableToolName(name: string): name is ToggleableToolName {
  return (TOGGLEABLE_TOOL_NAMES as readonly string[]).includes(name)
}
