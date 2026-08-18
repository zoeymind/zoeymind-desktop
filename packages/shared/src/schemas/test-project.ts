import { z } from 'zod'

// ============ 枚举定义 ============

export const TestCaseProjectStatusEnum = z.enum(['ACTIVE', 'ARCHIVED'])
export const TestCaseStatusEnum = z.enum([
  'ACTIVE',
  'PENDING_REVIEW',
  'REVIEW_PASSED',
  'REVIEW_FAILED',
  'ARCHIVED'
])
export const VersionStatusEnum = z.enum(['UNRELEASED', 'RELEASED', 'ARCHIVED'])
// 计划状态根据执行情况自动计算
// DRAFT 和 ARCHIVED 保留用于兼容旧数据
export const TestPlanStatusEnum = z.enum([
  'DRAFT', // 旧状态，等同于 NOT_STARTED
  'NOT_STARTED', // 所有用例都是未执行状态
  'IN_PROGRESS', // 有部分用例已执行
  'COMPLETED', // 所有用例都已执行
  'OVERDUE', // 已超过计划结束日期但未完成
  'ARCHIVED' // 旧状态，保留用于兼容
])
export const ExecutionStatusEnum = z.enum([
  'NOT_EXECUTED',
  'PASSED',
  'FAILED',
  'BLOCKED',
  'SKIPPED'
])
export const TestWorkspaceMemberRoleEnum = z.enum(['OWNER', 'ADMIN', 'MEMBER', 'VIEWER'])

// ============ 类型导出 ============

export type TestCaseProjectStatus = z.infer<typeof TestCaseProjectStatusEnum>
export type TestCaseStatus = z.infer<typeof TestCaseStatusEnum>
export type VersionStatus = z.infer<typeof VersionStatusEnum>
export type TestPlanStatus = z.infer<typeof TestPlanStatusEnum>
export type ExecutionStatus = z.infer<typeof ExecutionStatusEnum>
export type TestWorkspaceMemberRole = z.infer<typeof TestWorkspaceMemberRoleEnum>

export type TestCaseStatusValues =
  | 'ACTIVE'
  | 'PENDING_REVIEW'
  | 'REVIEW_PASSED'
  | 'REVIEW_FAILED'
  | 'ARCHIVED'

// 测试用例步骤结构
export const TestCaseStepSchema = z.object({
  action: z.string(),
  expected: z.string()
})

export type TestCaseStep = z.infer<typeof TestCaseStepSchema>

// 测试用例步骤数组（可为 null）
export const TestCaseStepsSchema = z.array(TestCaseStepSchema).nullable()

export type TestCaseSteps = z.infer<typeof TestCaseStepsSchema>

// 测试计划用例快照数据结构
export const TestPlanCaseSnapshotSchema = z.object({
  caseId: z.string(),
  caseName: z.string(),
  priority: z.number(),
  description: z.string().nullable(),
  preconditions: z.string().nullable(),
  steps: z
    .array(
      z.object({
        action: z.string(),
        expected: z.string()
      })
    )
    .nullable(),
  moduleName: z.string().nullable(),
  creatorName: z.string().nullable(),
  snapshotCreatedAt: z.date()
})

export type TestPlanCaseSnapshot = z.infer<typeof TestPlanCaseSnapshotSchema>

// 测试计划用例数据结构
export const TestPlanCaseSchema = z.object({
  id: z.string().cuid(),
  testCaseId: z.string().cuid().nullable(),
  testPlanId: z.string().cuid(),
  executionStatus: ExecutionStatusEnum,
  executionNotes: z.string().nullable(),
  createdAt: z.date(),
  snapshot: TestPlanCaseSnapshotSchema
})

export type TestPlanCase = z.infer<typeof TestPlanCaseSchema>

// ============ 测试计划 Input Schemas ============

// 获取可用用例的输入
export const GetAvailableCasesInputSchema = z.object({
  testPlanId: z.string().cuid(),
  workspaceId: z.string().cuid(),
  moduleId: z.string().cuid().optional(),
  search: z.string().optional(),
  priority: z.number().int().min(1).max(3).optional(),
  status: TestCaseStatusEnum.optional(),
  page: z.number().min(1).default(1),
  pageSize: z.number().min(1).max(100).default(20)
})

export type GetAvailableCasesInput = z.infer<typeof GetAvailableCasesInputSchema>

// 列表查询用例的输入
export const ListPlanCasesInputSchema = z.object({
  testPlanId: z.string().cuid(),
  moduleId: z.string().cuid().optional(),
  search: z.string().optional(),
  executionStatus: ExecutionStatusEnum.optional(),
  priority: z.number().int().min(1).max(3).optional(),
  assignedToIds: z.array(z.string()).optional(),
  page: z.number().min(1).default(1),
  pageSize: z.number().min(1).max(9999).default(20)
})

export type ListPlanCasesInput = z.infer<typeof ListPlanCasesInputSchema>

// 添加用例到测试计划
export const AddCasesToPlanInputSchema = z.object({
  testPlanId: z.string().cuid(),
  workspaceId: z.string().cuid(), // 用于权限检查
  testCaseIds: z.array(z.string().cuid())
})

export type AddCasesToPlanInput = z.infer<typeof AddCasesToPlanInputSchema>

// 按模块添加用例
export const AddCasesByModuleInputSchema = z.object({
  testPlanId: z.string().cuid(),
  workspaceId: z.string().cuid(), // 用于权限检查
  moduleId: z.string().cuid(),
  includeSubmodules: z.boolean().default(true)
})

export type AddCasesByModuleInput = z.infer<typeof AddCasesByModuleInputSchema>

// 更新执行状态（批量）
export const UpdateExecutionStatusInputSchema = z.object({
  workspaceId: z.string().cuid(), // 用于权限检查
  planCaseIds: z.array(z.string().cuid()),
  executionStatus: ExecutionStatusEnum,
  executionNotes: z.string().optional()
})

export type UpdateExecutionStatusInput = z.infer<typeof UpdateExecutionStatusInputSchema>

// ============ Assignment Schemas ==========

// 批量指派输入
export const BatchAssignInputSchema = z.object({
  testPlanId: z.string().cuid(),
  planCaseIds: z.array(z.string().cuid()).min(1),
  assigneeId: z.string()
})

export type BatchAssignInput = z.infer<typeof BatchAssignInputSchema>

// 更新单个指派输入
export const UpdateAssigneeInputSchema = z.object({
  planCaseId: z.string().cuid(),
  assigneeId: z.string().optional()
})

export type UpdateAssigneeInput = z.infer<typeof UpdateAssigneeInputSchema>

// 指派统计
export interface AssignmentStats {
  total: number
  assigned: number
  unassigned: number
  byAssignee: Array<{
    userId: string
    userName: string
    userAvatar: string | null
    count: number
  }>
}

// 我的用例列表输入
export const MyCasesListInputSchema = z.object({
  testPlanId: z.string().cuid(),
  page: z.number().min(1).default(1),
  pageSize: z.number().min(1).max(100).default(20)
})

export type MyCasesListInput = z.infer<typeof MyCasesListInputSchema>

// ============ Execution Schemas ==========

// 批量更新执行状态
export const BatchUpdateStatusInputSchema = z.object({
  planCaseIds: z.array(z.string().cuid()).min(1),
  executionStatus: z.enum(['NOT_EXECUTED', 'PASSED', 'FAILED', 'BLOCKED', 'SKIPPED'])
})

export type BatchUpdateStatusInput = z.infer<typeof BatchUpdateStatusInputSchema>

// 更新执行备注
export const UpdateNotesInputSchema = z.object({
  planCaseId: z.string().cuid(),
  notes: z.string().optional()
})

export type UpdateNotesInput = z.infer<typeof UpdateNotesInputSchema>

// 执行统计
export interface ExecutionStats {
  total: number
  notExecuted: number
  passed: number
  failed: number
  blocked: number
  skipped: number
  passRate: number // 通过率（百分比）
}

// ============ Snapshot Schemas ==========

export interface TestCaseSnapshot {
  caseId: string
  caseName: string
  priority: number
  description: string | null
  preconditions: string | null
  steps: TestCaseStep[] | null
  moduleName: string | null
  creatorName: string | null
  createdAt: Date
}

export interface SnapshotCreateOptions {
  includeSteps?: boolean
}

// ============ UI 自动化测试 Schemas ============

// UI 测试用例优先级枚举
export const UITestCasePriorityEnum = z.enum(['P0', 'P1', 'P2', 'P3'])
export type UITestCasePriority = z.infer<typeof UITestCasePriorityEnum>

// UI 测试用例状态枚举（与 Prisma schema 一致）
export const UITestCaseStatusEnum = z.enum(['DRAFT', 'ACTIVE', 'DISABLED', 'ARCHIVED'])
export type UITestCaseStatus = z.infer<typeof UITestCaseStatusEnum>

// ============ UI 测试套件 Schemas（组织用例，树形结构） ============

// 获取 UI 套件列表输入
export const UITestSuiteListInputSchema = z.object({
  workspaceId: z.string().cuid()
})
export type UITestSuiteListInput = z.infer<typeof UITestSuiteListInputSchema>

// 创建 UI 套件输入
export const UITestSuiteCreateInputSchema = z.object({
  workspaceId: z.string().cuid(),
  parentId: z.string().cuid().optional().nullable(),
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  sort: z.number().int().optional().default(0),
  // 图片识别阈值配置
  defaultConfidenceThreshold: z.number().min(0).max(1).optional(),
  defaultMatchThreshold: z.number().min(0).max(1).optional()
})
export type UITestSuiteCreateInput = z.infer<typeof UITestSuiteCreateInputSchema>

// 更新 UI 套件输入
export const UITestSuiteUpdateInputSchema = z.object({
  id: z.string().cuid(),
  workspaceId: z.string().cuid(),
  name: z.string().min(1).max(100).optional(),
  description: z.string().optional().nullable(),
  sort: z.number().int().optional(),
  // 图片识别阈值配置
  defaultConfidenceThreshold: z.number().min(0).max(1).optional().nullable(),
  defaultMatchThreshold: z.number().min(0).max(1).optional().nullable()
})
export type UITestSuiteUpdateInput = z.infer<typeof UITestSuiteUpdateInputSchema>

// 删除 UI 套件输入
export const UITestSuiteDeleteInputSchema = z.object({
  id: z.string().cuid(),
  workspaceId: z.string().cuid()
})
export type UITestSuiteDeleteInput = z.infer<typeof UITestSuiteDeleteInputSchema>

// 移动 UI 套件输入
export const UITestSuiteMoveInputSchema = z.object({
  id: z.string().cuid(),
  workspaceId: z.string().cuid(),
  newParentId: z.string().cuid().optional().nullable()
})
export type UITestSuiteMoveInput = z.infer<typeof UITestSuiteMoveInputSchema>

// 批量更新 UI 套件排序输入
export const UITestSuiteBatchUpdateSortInputSchema = z.object({
  workspaceId: z.string().cuid(),
  updates: z.array(
    z.object({
      id: z.string().cuid(),
      sort: z.number().int()
    })
  )
})
export type UITestSuiteBatchUpdateSortInput = z.infer<typeof UITestSuiteBatchUpdateSortInputSchema>

// 获取 UI 套件详情输入
export const UITestSuiteGetInputSchema = z.object({
  id: z.string().cuid(),
  workspaceId: z.string().cuid()
})
export type UITestSuiteGetInput = z.infer<typeof UITestSuiteGetInputSchema>

// ============ UI 测试用例 Schemas ============

// 获取 UI 用例列表输入
export const UITestCaseListInputSchema = z.object({
  workspaceId: z.string().cuid(),
  suiteId: z.string().cuid().optional().nullable(),
  page: z.number().optional().default(1),
  limit: z.number().optional().default(20),
  search: z.string().optional(),
  createdBy: z.string().optional(),
  priority: UITestCasePriorityEnum.optional(),
  status: UITestCaseStatusEnum.optional()
})
export type UITestCaseListInput = z.infer<typeof UITestCaseListInputSchema>

// 获取 UI 用例详情输入
export const UITestCaseGetInputSchema = z.object({
  id: z.string().cuid(),
  workspaceId: z.string().cuid()
})
export type UITestCaseGetInput = z.infer<typeof UITestCaseGetInputSchema>

// 图片识别阈值配置 Schema（可复用）
export const ThresholdConfigSchema = z.object({
  defaultConfidenceThreshold: z.number().min(0).max(1).optional().nullable(),
  defaultMatchThreshold: z.number().min(0).max(1).optional().nullable()
})
export type ThresholdConfig = z.infer<typeof ThresholdConfigSchema>

// 创建 UI 用例输入
export const UITestCaseCreateInputSchema = z.object({
  workspaceId: z.string().cuid(),
  suiteId: z.string().cuid().optional().nullable(),
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  priority: UITestCasePriorityEnum.optional().default('P2'),
  // 图片识别阈值配置
  defaultConfidenceThreshold: z.number().min(0).max(1).optional(),
  defaultMatchThreshold: z.number().min(0).max(1).optional()
})
export type UITestCaseCreateInput = z.infer<typeof UITestCaseCreateInputSchema>

// 更新 UI 用例输入
export const UITestCaseUpdateInputSchema = z.object({
  id: z.string().cuid(),
  workspaceId: z.string().cuid(),
  suiteId: z.string().cuid().optional().nullable(),
  name: z.string().min(1).max(200).optional(),
  description: z.string().optional().nullable(),
  priority: UITestCasePriorityEnum.optional(),
  status: UITestCaseStatusEnum.optional(),
  // 图片识别阈值配置
  defaultConfidenceThreshold: z.number().min(0).max(1).optional().nullable(),
  defaultMatchThreshold: z.number().min(0).max(1).optional().nullable()
})
export type UITestCaseUpdateInput = z.infer<typeof UITestCaseUpdateInputSchema>

// 删除 UI 用例输入
export const UITestCaseDeleteInputSchema = z.object({
  id: z.string().cuid(),
  workspaceId: z.string().cuid()
})
export type UITestCaseDeleteInput = z.infer<typeof UITestCaseDeleteInputSchema>

// ============ UI 测试计划 Schemas（选择用例执行） ============

// 获取 UI 计划列表输入
export const UITestPlanListInputSchema = z.object({
  workspaceId: z.string().cuid(),
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(50)
})
export type UITestPlanListInput = z.infer<typeof UITestPlanListInputSchema>

// 获取 UI 计划详情输入
export const UITestPlanGetInputSchema = z.object({
  id: z.string().cuid(),
  workspaceId: z.string().cuid()
})
export type UITestPlanGetInput = z.infer<typeof UITestPlanGetInputSchema>

// 创建 UI 计划输入
export const UITestPlanCreateInputSchema = z.object({
  workspaceId: z.string().cuid(),
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  // 图片识别阈值配置
  defaultConfidenceThreshold: z.number().min(0).max(1).optional(),
  defaultMatchThreshold: z.number().min(0).max(1).optional()
})
export type UITestPlanCreateInput = z.infer<typeof UITestPlanCreateInputSchema>

// 更新 UI 计划输入
export const UITestPlanUpdateInputSchema = z.object({
  id: z.string().cuid(),
  workspaceId: z.string().cuid(),
  name: z.string().min(1).max(200).optional(),
  description: z.string().optional().nullable(),
  // 图片识别阈值配置
  defaultConfidenceThreshold: z.number().min(0).max(1).optional().nullable(),
  defaultMatchThreshold: z.number().min(0).max(1).optional().nullable()
})
export type UITestPlanUpdateInput = z.infer<typeof UITestPlanUpdateInputSchema>

// 删除 UI 计划输入
export const UITestPlanDeleteInputSchema = z.object({
  id: z.string().cuid(),
  workspaceId: z.string().cuid()
})
export type UITestPlanDeleteInput = z.infer<typeof UITestPlanDeleteInputSchema>

// 计划添加用例输入
export const UITestPlanAddCasesInputSchema = z.object({
  planId: z.string().cuid(),
  workspaceId: z.string().cuid(),
  caseIds: z.array(z.string().cuid()).min(1)
})
export type UITestPlanAddCasesInput = z.infer<typeof UITestPlanAddCasesInputSchema>

// 计划移除用例输入
export const UITestPlanRemoveCasesInputSchema = z.object({
  planId: z.string().cuid(),
  workspaceId: z.string().cuid(),
  caseIds: z.array(z.string().cuid()).min(1)
})
export type UITestPlanRemoveCasesInput = z.infer<typeof UITestPlanRemoveCasesInputSchema>

// 计划用例排序输入
export const UITestPlanReorderCasesInputSchema = z.object({
  planId: z.string().cuid(),
  workspaceId: z.string().cuid(),
  caseIds: z.array(z.string().cuid()) // 按顺序排列的用例 ID
})
export type UITestPlanReorderCasesInput = z.infer<typeof UITestPlanReorderCasesInputSchema>

// 切换计划用例启用状态输入
export const UITestPlanToggleCaseInputSchema = z.object({
  planId: z.string().cuid(),
  workspaceId: z.string().cuid(),
  caseId: z.string().cuid(),
  isEnabled: z.boolean()
})
export type UITestPlanToggleCaseInput = z.infer<typeof UITestPlanToggleCaseInputSchema>

// ============ UI 测试步骤 Schemas ============

// Agent 环境能力信息（客户端上报，存储在 UIAgent.capabilities JSON 字段）
export const AgentCapabilitiesSchema = z.object({
  pythonAvailable: z.boolean(),
  pythonVersion: z.string(),
  pythonPath: z.string()
})
export type AgentCapabilities = z.infer<typeof AgentCapabilitiesSchema>

// UI 定位类型枚举（与 Prisma schema 一致）
export const UILocationTypeEnum = z.enum(['OCR', 'IMAGE', 'SCRIPT'])
export type UILocationType = z.infer<typeof UILocationTypeEnum>

// UI 动作类型枚举（与 Prisma schema 一致）
export const UIActionTypeEnum = z.enum([
  'CLICK',
  'DOUBLE_CLICK',
  'RIGHT_CLICK',
  'HOVER',
  'DRAG',
  'INPUT',
  'WAIT',
  'KEYBOARD',
  'LAUNCH_APP',
  'CLOSE_APP',
  'SCREENSHOT',
  'ASSERT',
  'RUN_PYTHON'
])
export type UIActionType = z.infer<typeof UIActionTypeEnum>

// 不需要定位器的操作类型（系统定位器）
export const NO_LOCATOR_ACTION_TYPES: UIActionType[] = [
  'WAIT',
  'KEYBOARD',
  'LAUNCH_APP',
  'CLOSE_APP',
  'SCREENSHOT',
  'ASSERT'
]

// 获取 UI 测试步骤列表输入
export const UITestStepListInputSchema = z.object({
  testCaseId: z.string().cuid(),
  workspaceId: z.string().cuid()
})
export type UITestStepListInput = z.infer<typeof UITestStepListInputSchema>

// 创建 UI 测试步骤输入
export const UITestStepCreateInputSchema = z.object({
  testCaseId: z.string().cuid(),
  workspaceId: z.string().cuid(),
  order: z.number().int().optional(),

  // 定位器引用（可选）
  locatorId: z.string().cuid().optional().nullable(),

  // 直接配置定位参数（当 locatorId 为空时使用）
  locationType: UILocationTypeEnum.optional().nullable(),

  // OCR 定位参数
  ocrText: z.string().optional().nullable(),
  confidenceThreshold: z.number().optional().nullable(),

  // 图像匹配定位参数
  imageTemplate: z.string().optional().nullable(), // Base64 encoded
  matchThreshold: z.number().optional().nullable(),
  imageClickGrid: z.string().optional().nullable(),

  // 操作配置
  action: UIActionTypeEnum,
  actionParams: z.record(z.string(), z.unknown()).optional().nullable(),

  // 其他配置
  description: z.string().optional().nullable(),
  clearBeforeInput: z.boolean().optional().default(false),
  retryCount: z.number().int().optional().default(3),
  timeout: z.number().optional().default(10.0)
})
export type UITestStepCreateInput = z.infer<typeof UITestStepCreateInputSchema>

// 更新 UI 测试步骤输入
export const UITestStepUpdateInputSchema = z.object({
  id: z.string().cuid(),
  workspaceId: z.string().cuid(),

  // 定位器引用
  locatorId: z.string().cuid().optional().nullable(),

  // 直接配置定位参数
  locationType: UILocationTypeEnum.optional().nullable(),

  // OCR 定位参数
  ocrText: z.string().optional().nullable(),
  confidenceThreshold: z.number().optional().nullable(),

  // 图像匹配定位参数
  imageTemplate: z.string().optional().nullable(),
  matchThreshold: z.number().optional().nullable(),
  imageClickGrid: z.string().optional().nullable(),

  // 操作配置
  action: UIActionTypeEnum.optional(),
  actionParams: z.record(z.string(), z.unknown()).optional().nullable(),

  // 其他配置
  description: z.string().optional().nullable(),
  clearBeforeInput: z.boolean().optional(),
  retryCount: z.number().int().optional(),
  timeout: z.number().optional()
})
export type UITestStepUpdateInput = z.infer<typeof UITestStepUpdateInputSchema>

// 删除 UI 测试步骤输入
export const UITestStepDeleteInputSchema = z.object({
  id: z.string().cuid(),
  workspaceId: z.string().cuid()
})
export type UITestStepDeleteInput = z.infer<typeof UITestStepDeleteInputSchema>

// 重新排序 UI 测试步骤输入
export const UITestStepReorderInputSchema = z.object({
  testCaseId: z.string().cuid(),
  workspaceId: z.string().cuid(),
  stepOrders: z.array(
    z.object({
      id: z.string().cuid(),
      order: z.number().int()
    })
  )
})
export type UITestStepReorderInput = z.infer<typeof UITestStepReorderInputSchema>

// ============ UI 测试步骤返回类型（供前后端共用） ============

// 步骤关联的定位器信息
export const UITestStepLocatorSchema = z.object({
  id: z.string(),
  name: z.string(),
  locationType: UILocationTypeEnum
})
export type UITestStepLocator = z.infer<typeof UITestStepLocatorSchema>

// JSON 值类型（兼容 Prisma 的 JsonValue）
// 不递归 — Zod 4 + TS 在深递归 union 上会报 "excessively deep" 实例化错误
// 实务上 actionParams 等存的是单层 object，足够覆盖
export type JsonValue = string | number | boolean | null | { [k: string]: unknown } | unknown[]
const JsonValueSchema = z.custom<JsonValue>()

// 单个步骤的完整数据
export const UITestStepSchema = z.object({
  id: z.string(),
  testCaseId: z.string(),
  order: z.number(),
  action: UIActionTypeEnum,
  actionParams: JsonValueSchema.nullable(),
  description: z.string().nullable(),
  locatorId: z.string().nullable(),
  locationType: UILocationTypeEnum.nullable(),
  ocrText: z.string().nullable(),
  confidenceThreshold: z.number().nullable(),
  matchThreshold: z.number().nullable(),
  imageClickGrid: z.string().nullable(),
  clearBeforeInput: z.boolean(),
  retryCount: z.number(),
  timeout: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
  locator: UITestStepLocatorSchema.nullable()
})
export type UITestStep = z.infer<typeof UITestStepSchema>

// 步骤列表返回
export const UITestStepListOutputSchema = z.object({
  success: z.boolean(),
  data: z.array(UITestStepSchema)
})
export type UITestStepListOutput = z.infer<typeof UITestStepListOutputSchema>

// ============ UI 定位器模块 Schemas ============

// 获取定位器模块列表输入（返回扁平数据）
export const UILocatorModuleListInputSchema = z.object({
  workspaceId: z.string().cuid()
})
export type UILocatorModuleListInput = z.infer<typeof UILocatorModuleListInputSchema>

// 获取定位器模块树输入（保留兼容）
export const UILocatorModuleTreeInputSchema = z.object({
  workspaceId: z.string().cuid()
})
export type UILocatorModuleTreeInput = z.infer<typeof UILocatorModuleTreeInputSchema>

// 创建定位器模块输入
export const UILocatorModuleCreateInputSchema = z.object({
  workspaceId: z.string().cuid(),
  parentModuleId: z.string().cuid().optional().nullable(),
  name: z.string().min(1).max(100),
  description: z.string().optional().nullable()
})
export type UILocatorModuleCreateInput = z.infer<typeof UILocatorModuleCreateInputSchema>

// 更新定位器模块输入
export const UILocatorModuleUpdateInputSchema = z.object({
  id: z.string().cuid(),
  workspaceId: z.string().cuid(),
  name: z.string().min(1).max(100).optional(),
  description: z.string().optional().nullable(),
  parentModuleId: z.string().cuid().optional().nullable()
})
export type UILocatorModuleUpdateInput = z.infer<typeof UILocatorModuleUpdateInputSchema>

// 删除定位器模块输入
export const UILocatorModuleDeleteInputSchema = z.object({
  id: z.string().cuid(),
  workspaceId: z.string().cuid()
})
export type UILocatorModuleDeleteInput = z.infer<typeof UILocatorModuleDeleteInputSchema>

// 移动定位器模块输入
export const UILocatorModuleMoveInputSchema = z.object({
  id: z.string().cuid(),
  workspaceId: z.string().cuid(),
  newParentId: z.string().cuid().optional().nullable()
})
export type UILocatorModuleMoveInput = z.infer<typeof UILocatorModuleMoveInputSchema>

// 批量更新定位器模块排序输入
export const UILocatorModuleBatchUpdateSortInputSchema = z.object({
  workspaceId: z.string().cuid(),
  updates: z.array(
    z.object({
      id: z.string().cuid(),
      sort: z.number().int()
    })
  )
})
export type UILocatorModuleBatchUpdateSortInput = z.infer<
  typeof UILocatorModuleBatchUpdateSortInputSchema
>

// 定位器模块返回类型
export const UILocatorModuleSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  parentModuleId: z.string().nullable(),
  name: z.string(),
  description: z.string().nullable(),
  order: z.number(),
  createdAt: z.string(),
  updatedAt: z.string()
})
export type UILocatorModule = z.infer<typeof UILocatorModuleSchema>

// 定位器模块列表项（扁平结构，映射为通用 ModuleItem 格式）
export const UILocatorModuleListItemSchema = z.object({
  id: z.string(),
  parentId: z.string().nullable(), // 映射自 parentModuleId
  name: z.string(),
  description: z.string().nullable(),
  level: z.number().int(), // 计算得出
  sort: z.number().int(), // 映射自 order
  itemCount: z.number().int().optional() // 定位器数量
})
export type UILocatorModuleListItem = z.infer<typeof UILocatorModuleListItemSchema>

// 定位器模块列表返回
export const UILocatorModuleListOutputSchema = z.object({
  success: z.boolean(),
  data: z.array(UILocatorModuleListItemSchema)
})
export type UILocatorModuleListOutput = z.infer<typeof UILocatorModuleListOutputSchema>

// 定位器模块树节点（保留兼容）
// 注意：TS 5.9 + Zod 3.25 下 z.lazy 的 ZodType 注解有类型兼容问题，
// 这里用 interface 手动定义递归类型，避免触发 _type 推导 bug
export interface UILocatorModuleTreeNode {
  id: string
  name: string
  description: string | null
  children: UILocatorModuleTreeNode[]
}

export const UILocatorModuleTreeNodeSchema: z.ZodType<UILocatorModuleTreeNode> = z.lazy(() =>
  z.object({
    id: z.string(),
    name: z.string(),
    description: z.string().nullable(),
    children: z.array(UILocatorModuleTreeNodeSchema)
  })
) as unknown as z.ZodType<UILocatorModuleTreeNode>

// ============ UI 定位器 Schemas ============

// 定位器配置类型
export const UILocatorConfigSchema = z.object({
  // OCR 参数
  ocrText: z.string().optional().nullable(),
  confidenceThreshold: z.number().optional().nullable(),
  // 图像匹配参数
  imageTemplate: z.string().optional().nullable(),
  matchThreshold: z.number().optional().nullable(),
  imageClickGrid: z.string().optional().nullable(),
  // SCRIPT 参数（Python 代码）
  code: z.string().optional().nullable(),
  timeout: z.number().optional().nullable()
})
export type UILocatorConfig = z.infer<typeof UILocatorConfigSchema>

// 获取定位器列表输入
export const UILocatorListInputSchema = z.object({
  workspaceId: z.string().cuid(),
  moduleId: z.string().cuid().optional().nullable(),
  search: z.string().optional(),
  locationType: UILocationTypeEnum.optional(),
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(50)
})
export type UILocatorListInput = z.infer<typeof UILocatorListInputSchema>

// 获取单个定位器输入
export const UILocatorGetInputSchema = z.object({
  id: z.string().cuid(),
  workspaceId: z.string().cuid()
})
export type UILocatorGetInput = z.infer<typeof UILocatorGetInputSchema>

// 创建定位器输入
export const UILocatorCreateInputSchema = z.object({
  workspaceId: z.string().cuid(),
  moduleId: z.string().cuid().optional().nullable(),
  name: z.string().min(1).max(100),
  locationType: UILocationTypeEnum,
  locationConfig: UILocatorConfigSchema
})
export type UILocatorCreateInput = z.infer<typeof UILocatorCreateInputSchema>

// 更新定位器输入
export const UILocatorUpdateInputSchema = z.object({
  id: z.string().cuid(),
  workspaceId: z.string().cuid(),
  moduleId: z.string().cuid().optional().nullable(),
  name: z.string().min(1).max(100).optional(),
  locationType: UILocationTypeEnum.optional(),
  locationConfig: UILocatorConfigSchema.optional()
})
export type UILocatorUpdateInput = z.infer<typeof UILocatorUpdateInputSchema>

// 删除定位器输入
export const UILocatorDeleteInputSchema = z.object({
  id: z.string().cuid(),
  workspaceId: z.string().cuid()
})
export type UILocatorDeleteInput = z.infer<typeof UILocatorDeleteInputSchema>

// 定位器返回类型
export const UILocatorSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  moduleId: z.string().nullable(),
  name: z.string(),
  locationType: UILocationTypeEnum,
  locationConfig: UILocatorConfigSchema,
  order: z.number(),
  createdBy: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  module: z
    .object({
      id: z.string(),
      name: z.string()
    })
    .nullable(),
  creator: z.object({
    id: z.string(),
    name: z.string().nullable()
  }),
  _count: z
    .object({
      steps: z.number()
    })
    .optional()
})
export type UILocator = z.infer<typeof UILocatorSchema>

// 定位器列表返回
export const UILocatorListOutputSchema = z.object({
  success: z.boolean(),
  data: z.array(UILocatorSchema),
  total: z.number(),
  page: z.number(),
  limit: z.number()
})
export type UILocatorListOutput = z.infer<typeof UILocatorListOutputSchema>

// ============ UI 测试步骤执行 Schemas ============

// Worker 任务类型枚举
export const WorkerTaskTypeEnum = z.enum([
  'click_image',
  'click_text',
  'type_text',
  'key_press',
  'screenshot',
  'wait_image',
  'wait_text',
  'wait_time',
  'mouse_move',
  'mouse_click',
  'activate_app',
  'close_app',
  'grid_click',
  'image_exists',
  'text_exists',
  'get_clipboard',
  'set_clipboard',
  'assert_image',
  'assert_text',
  'run_python'
])
export type WorkerTaskType = z.infer<typeof WorkerTaskTypeEnum>

// UIActionType 到 WorkerTaskType 的映射
export const UI_ACTION_TO_WORKER_TASK: Record<
  UIActionType,
  { locationType: UILocationType | null; taskType: WorkerTaskType }[]
> = {
  CLICK: [
    { locationType: 'OCR', taskType: 'click_text' },
    { locationType: 'IMAGE', taskType: 'click_image' },
    { locationType: null, taskType: 'mouse_click' }
  ],
  DOUBLE_CLICK: [
    { locationType: 'OCR', taskType: 'click_text' },
    { locationType: 'IMAGE', taskType: 'click_image' },
    { locationType: null, taskType: 'mouse_click' }
  ],
  RIGHT_CLICK: [
    { locationType: 'OCR', taskType: 'click_text' },
    { locationType: 'IMAGE', taskType: 'click_image' },
    { locationType: null, taskType: 'mouse_click' }
  ],
  HOVER: [{ locationType: null, taskType: 'mouse_move' }],
  DRAG: [{ locationType: null, taskType: 'mouse_move' }],
  INPUT: [{ locationType: null, taskType: 'type_text' }],
  WAIT: [
    { locationType: 'IMAGE', taskType: 'wait_image' },
    { locationType: 'OCR', taskType: 'wait_text' },
    { locationType: null, taskType: 'wait_time' }
  ],
  KEYBOARD: [{ locationType: null, taskType: 'key_press' }],
  LAUNCH_APP: [{ locationType: null, taskType: 'activate_app' }],
  CLOSE_APP: [{ locationType: null, taskType: 'close_app' }],
  SCREENSHOT: [{ locationType: null, taskType: 'screenshot' }],
  ASSERT: [
    { locationType: 'IMAGE', taskType: 'assert_image' },
    { locationType: 'OCR', taskType: 'assert_text' }
  ],
  RUN_PYTHON: [
    { locationType: 'SCRIPT', taskType: 'run_python' },
    { locationType: null, taskType: 'run_python' }
  ]
}

// 根据 UIActionType 和定位类型获取 WorkerTaskType
export function getWorkerTaskType(
  action: UIActionType,
  locationType: UILocationType | null
): WorkerTaskType | null {
  const mappings = UI_ACTION_TO_WORKER_TASK[action]
  if (!mappings) return null

  // 优先匹配定位类型
  const exactMatch = mappings.find(m => m.locationType === locationType)
  if (exactMatch) return exactMatch.taskType

  // 如果没有精确匹配，使用 null 定位类型的默认映射
  const defaultMatch = mappings.find(m => m.locationType === null)
  return defaultMatch?.taskType ?? null
}

// 所有可用的操作类型
const ALL_UI_ACTION_TYPES: UIActionType[] = [
  'CLICK',
  'DOUBLE_CLICK',
  'RIGHT_CLICK',
  'HOVER',
  'DRAG',
  'INPUT',
  'WAIT',
  'KEYBOARD',
  'LAUNCH_APP',
  'CLOSE_APP',
  'SCREENSHOT',
  'ASSERT',
  'RUN_PYTHON'
]

/**
 * 根据定位器类型获取可用的操作类型列表
 * @param locationType 定位器类型，null 表示无定位器/未选择
 * @returns 该定位器类型支持的操作类型列表
 */
export function getAvailableActionsForLocationType(
  locationType: UILocationType | null
): UIActionType[] {
  // 如果没有选择定位器，返回所有操作类型（让用户先选操作）
  if (locationType === null) {
    return ALL_UI_ACTION_TYPES
  }

  return ALL_UI_ACTION_TYPES.filter(action => {
    const mappings = UI_ACTION_TO_WORKER_TASK[action]
    if (!mappings) return false

    // 精确匹配：只返回明确支持该定位器类型的操作
    // 不再fallback到 locationType === null 的映射，避免 SCRIPT 定位器显示 CLICK 等不相关操作
    return mappings.some(m => m.locationType === locationType)
  })
}

/**
 * 根据操作类型获取兼容的定位器类型列表
 * @param action 操作类型
 * @returns 该操作支持的定位器类型列表（包含 null 表示支持无定位器）
 */
export function getCompatibleLocatorTypesForAction(
  action: UIActionType
): (UILocationType | null)[] {
  const mappings = UI_ACTION_TO_WORKER_TASK[action]
  if (!mappings) return []
  return mappings.map(m => m.locationType)
}

/**
 * 检查操作类型和定位器类型是否兼容
 */
export function isActionCompatibleWithLocator(
  action: UIActionType,
  locationType: UILocationType | null
): boolean {
  const compatibleTypes = getCompatibleLocatorTypesForAction(action)
  return compatibleTypes.includes(locationType)
}

// 执行单步输入
export const UITestStepExecuteInputSchema = z.object({
  stepId: z.string().cuid(),
  workspaceId: z.string().cuid(),
  agentId: z.string().cuid()
})
export type UITestStepExecuteInput = z.infer<typeof UITestStepExecuteInputSchema>

// 执行结果状态
export const StepExecutionStatusEnum = z.enum([
  'PENDING',
  'RUNNING',
  'SUCCESS',
  'FAILED',
  'CANCELLED',
  'TIMEOUT'
])
export type StepExecutionStatus = z.infer<typeof StepExecutionStatusEnum>

// 执行结果
export const UITestStepExecuteResultSchema = z.object({
  success: z.boolean(),
  status: StepExecutionStatusEnum,
  message: z.string().optional(),
  durationMs: z.number().optional(),
  screenshot: z.string().optional(), // Base64 截图
  result: z.record(z.string(), z.unknown()).optional()
})
export type UITestStepExecuteResult = z.infer<typeof UITestStepExecuteResultSchema>

// 取消任务输入
export const UITestTaskCancelInputSchema = z.object({
  taskId: z.string(),
  workspaceId: z.string().cuid(),
  agentId: z.string().cuid(),
  reason: z.string().optional()
})
export type UITestTaskCancelInput = z.infer<typeof UITestTaskCancelInputSchema>

// ============ UI 测试计划执行 Schemas ============

// 执行状态枚举（与 Prisma schema 保持一致）
export const UIExecutionStatusEnum = z.enum([
  'PENDING',
  'RUNNING',
  'SUCCESS',
  'FAILED',
  'SKIPPED',
  'CANCELLED'
])
export type UIExecutionStatus = z.infer<typeof UIExecutionStatusEnum>

// ============ Agent 执行状态 Schemas ============

// Agent 执行状态枚举
export const AgentExecutionStatusEnum = z.enum(['IDLE', 'BUSY', 'PAUSED'])
export type AgentExecutionStatus = z.infer<typeof AgentExecutionStatusEnum>

// Agent 执行状态详情
export const AgentExecutionInfoSchema = z.object({
  status: AgentExecutionStatusEnum,
  currentTaskId: z.string().optional(),
  currentTaskType: z.string().optional(),
  taskStartedAt: z.number().optional(),
  runningTasksCount: z.number()
})
export type AgentExecutionInfo = z.infer<typeof AgentExecutionInfoSchema>

// 启动计划执行输入
export const UIPlanExecuteInputSchema = z.object({
  planId: z.string().cuid(),
  workspaceId: z.string().cuid(),
  agentId: z.string().cuid(),
  environmentId: z.string().cuid().optional()
})
export type UIPlanExecuteInput = z.infer<typeof UIPlanExecuteInputSchema>

// 启动用例执行输入
export const UICaseExecuteInputSchema = z.object({
  caseId: z.string().cuid(),
  workspaceId: z.string().cuid(),
  agentId: z.string().cuid(),
  environmentId: z.string().cuid().optional()
})
export type UICaseExecuteInput = z.infer<typeof UICaseExecuteInputSchema>

// 调试用例输入（不保存数据库）
export const UIDebugCaseInputSchema = z.object({
  caseId: z.string().cuid(),
  workspaceId: z.string().cuid(),
  agentId: z.string().cuid()
})
export type UIDebugCaseInput = z.infer<typeof UIDebugCaseInputSchema>

// 获取执行记录列表输入
export const UIExecutionListInputSchema = z.object({
  workspaceId: z.string().cuid(),
  planId: z.string().cuid().optional(),
  caseId: z.string().cuid().optional(),
  status: UIExecutionStatusEnum.optional(),
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(20)
})
export type UIExecutionListInput = z.infer<typeof UIExecutionListInputSchema>

// 计划执行记录
export const UIPlanExecutionSchema = z.object({
  id: z.string(),
  planId: z.string(),
  planName: z.string().optional(),
  environmentId: z.string().nullable(),
  environmentName: z.string().nullable(),
  executorId: z.string().nullable(),
  executorName: z.string().nullable(),
  status: UIExecutionStatusEnum,
  startedAt: z.string().nullable(),
  finishedAt: z.string().nullable(),
  durationSeconds: z.number().nullable(),
  totalCases: z.number(),
  passedCases: z.number(),
  failedCases: z.number(),
  skippedCases: z.number(),
  createdAt: z.string()
})
export type UIPlanExecution = z.infer<typeof UIPlanExecutionSchema>

// 用例执行记录
export const UICaseExecutionSchema = z.object({
  id: z.string(),
  caseId: z.string(),
  caseName: z.string().optional(),
  planExecutionId: z.string().nullable(),
  environmentId: z.string().nullable(),
  status: UIExecutionStatusEnum,
  errorMessage: z.string().nullable(),
  startedAt: z.string().nullable(),
  finishedAt: z.string().nullable(),
  durationSeconds: z.number().nullable(),
  retryCount: z.number(),
  createdAt: z.string()
})
export type UICaseExecution = z.infer<typeof UICaseExecutionSchema>

// 步骤执行记录
export const UIStepExecutionSchema = z.object({
  id: z.string(),
  stepId: z.string(),
  caseExecutionId: z.string(),
  order: z.number(),
  status: UIExecutionStatusEnum,
  message: z.string().nullable(),
  screenshot: z.string().nullable(),
  debugInfo: z.record(z.string(), z.unknown()).nullable(),
  executedAt: z.string().nullable(),
  durationSeconds: z.number().nullable()
})
export type UIStepExecution = z.infer<typeof UIStepExecutionSchema>

// 边界信息（用于回放时高亮显示）
export const BoundsInfoSchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number()
})
export type BoundsInfo = z.infer<typeof BoundsInfoSchema>

// 位置信息（用于回放时显示点击动画）
export const PositionInfoSchema = z.object({
  x: z.number(),
  y: z.number()
})
export type PositionInfo = z.infer<typeof PositionInfoSchema>

// 滑动轨迹信息
export const SwipePathInfoSchema = z.object({
  startX: z.number(),
  startY: z.number(),
  endX: z.number(),
  endY: z.number()
})
export type SwipePathInfo = z.infer<typeof SwipePathInfoSchema>

// 步骤执行结果数据（Worker 返回，用于回放）
export const StepExecutionResultDataSchema = z.object({
  stepExecutionId: z.string().optional(),
  stepId: z.string(),
  status: z.enum(['SUCCESS', 'FAILED', 'SKIPPED']),
  screenshotBefore: z.string().optional(), // Base64
  screenshotAfter: z.string().optional(), // Base64
  actionType: z.enum([
    'click',
    'long_press',
    'double_click',
    'input',
    'swipe',
    'assert',
    'wait',
    'script',
    'other'
  ]),
  targetBounds: BoundsInfoSchema.optional(),
  clickPosition: PositionInfoSchema.optional(),
  swipePath: SwipePathInfoSchema.optional(),
  inputText: z.string().optional(),
  // 脚本执行输出（Python 等）
  stdout: z.string().optional(),
  stderr: z.string().optional(),
  exitCode: z.number().optional(),
  durationMs: z.number(),
  errorMessage: z.string().optional(),
  failureReason: z
    .enum(['NOT_FOUND', 'MULTIPLE_MATCHES', 'ASSERTION_FAILED', 'PARAM_ERROR', 'SYSTEM_ERROR'])
    .optional()
})
export type StepExecutionResultData = z.infer<typeof StepExecutionResultDataSchema>

// ============ UI 测试报告 Schemas ============

// 获取测试报告输入
export const UITestReportInputSchema = z.object({
  planExecutionId: z.string().cuid(),
  workspaceId: z.string().cuid()
})
export type UITestReportInput = z.infer<typeof UITestReportInputSchema>

// 报告统计数据
export const UIReportStatisticsSchema = z.object({
  totalCases: z.number(),
  passedCases: z.number(),
  failedCases: z.number(),
  skippedCases: z.number(),
  passRate: z.number(), // 0-100
  totalSteps: z.number(),
  passedSteps: z.number(),
  failedSteps: z.number(),
  totalDuration: z.number(), // 秒
  avgCaseDuration: z.number() // 秒
})
export type UIReportStatistics = z.infer<typeof UIReportStatisticsSchema>

// 用例摘要
export const UIReportCaseSummarySchema = z.object({
  caseId: z.string(),
  caseName: z.string(),
  status: UIExecutionStatusEnum,
  duration: z.number().nullable(),
  totalSteps: z.number(),
  passedSteps: z.number(),
  failedSteps: z.number(),
  errorMessage: z.string().nullable()
})
export type UIReportCaseSummary = z.infer<typeof UIReportCaseSummarySchema>

// 完整报告数据
export const UITestReportSchema = z.object({
  id: z.string(),
  planExecutionId: z.string(),
  planName: z.string(),
  environmentName: z.string().nullable(),
  executorName: z.string().nullable(),
  startedAt: z.string().nullable(),
  finishedAt: z.string().nullable(),
  statistics: UIReportStatisticsSchema,
  caseSummaries: z.array(UIReportCaseSummarySchema),
  generatedAt: z.string()
})
export type UITestReport = z.infer<typeof UITestReportSchema>

// ============ 执行日志相关 Schema ============

/**
 * 执行日志类型
 * - ack: 任务确认
 * - progress: 进度更新
 * - result: 最终结果
 */
export const ExecutionLogTypeEnum = z.enum(['ack', 'progress', 'result'])
export type ExecutionLogType = z.infer<typeof ExecutionLogTypeEnum>

/**
 * 创建执行日志输入
 */
export const CreateExecutionLogInputSchema = z.object({
  planExecutionId: z.string().cuid(),
  caseExecutionId: z.string().cuid(),
  stepId: z.string().optional().nullable(),
  taskId: z.string(),
  type: ExecutionLogTypeEnum,
  status: z.string(),
  message: z.string().optional().nullable(),
  resultJson: z.string().optional().nullable(),
  durationMs: z.number().int().positive().optional().nullable(),
  failureReason: z.string().optional().nullable(),
  matchLocation: z.string().optional().nullable()
})
export type CreateExecutionLogInput = z.infer<typeof CreateExecutionLogInputSchema>

/**
 * 执行日志过滤条件
 */
export const ExecutionLogFiltersSchema = z.object({
  taskId: z.string().optional(),
  type: z.string().optional(),
  stepId: z.string().optional()
})
export type ExecutionLogFilters = z.infer<typeof ExecutionLogFiltersSchema>

/**
 * 查询执行日志输入
 */
export const GetExecutionLogsInputSchema = z.object({
  planExecutionId: z.string().cuid(),
  taskId: z.string().optional(),
  type: z.string().optional(),
  stepId: z.string().optional(),
  page: z.number().int().positive().default(1),
  pageSize: z.number().int().positive().max(1000).default(100)
})
export type GetExecutionLogsInput = z.infer<typeof GetExecutionLogsInputSchema>
