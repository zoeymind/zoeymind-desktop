/**
 * 缺陷域状态机与展示配置 —— 前后端单一事实源（#104，来自缺陷原型定稿）。
 *
 * 状态机以原型为准（#81 body 矩阵已作废，见 #104 issue comment）：
 * - 打回/重开的目标态是 IN_PROGRESS（直接回开发手里），不是 NEW。
 * - NEW / IN_PROGRESS / SUSPENDED / REJECTED 均可直接 CLOSED（允许跳流程关闭）。
 * - `countsAsReopen` 仅限经过 RESOLVED 后再打开：RESOLVED→IN_PROGRESS（打回）、
 *   CLOSED→IN_PROGRESS（重开）。其余转移不计入 reopenCount。
 * - 一律一键流转、无强制备注（原因走评论区，评论系统独立后置）。
 *
 * `BUG_STATUS_ACTIONS` 是权限中立的转移表（列出所有合法目标态 + 是否计重开）；
 * 请求方需要的权限位由调用方按 `permission` 字段自行门控
 * （resolve→bug:resolve，close/reopen→bug:close/bug:reopen，
 * 其余转移只需 bug:update）。
 */

export const BUG_STATUSES = [
  'NEW',
  'IN_PROGRESS',
  'RESOLVED',
  'CLOSED',
  'SUSPENDED',
  'REJECTED'
] as const

export type BugStatus = (typeof BUG_STATUSES)[number]

export const BUG_SEVERITIES = ['BLOCKER', 'CRITICAL', 'MAJOR', 'MINOR', 'TRIVIAL'] as const
export type BugSeverity = (typeof BUG_SEVERITIES)[number]

export const BUG_PRIORITIES = ['P0', 'P1', 'P2', 'P3'] as const
export type BugPriority = (typeof BUG_PRIORITIES)[number]

/** 状态流转所需的权限位类别；调用方据此映射到具体 ProjectPermission。 */
export type BugTransitionPermission = 'update' | 'resolve' | 'close' | 'reopen'

export interface BugStatusTransition {
  to: BugStatus
  /** 判定该转移所需权限位类别（业务含义，非字面权限 statement）。 */
  permission: BugTransitionPermission
  /** 经过 RESOLVED 后再打开才计一次重开（RESOLVED→IN_PROGRESS / CLOSED→IN_PROGRESS）。 */
  countsAsReopen?: boolean
}

/** 合法转移矩阵：每个状态可流转到的目标态集合 + 判定所需权限位类别。 */
export const BUG_STATUS_TRANSITIONS: Record<BugStatus, BugStatusTransition[]> = {
  NEW: [
    { to: 'IN_PROGRESS', permission: 'update' },
    { to: 'SUSPENDED', permission: 'update' },
    { to: 'CLOSED', permission: 'close' },
    { to: 'REJECTED', permission: 'update' }
  ],
  IN_PROGRESS: [
    { to: 'RESOLVED', permission: 'resolve' },
    { to: 'SUSPENDED', permission: 'update' },
    { to: 'CLOSED', permission: 'close' }
  ],
  RESOLVED: [
    { to: 'CLOSED', permission: 'close' },
    { to: 'IN_PROGRESS', permission: 'reopen', countsAsReopen: true }
  ],
  CLOSED: [{ to: 'IN_PROGRESS', permission: 'reopen', countsAsReopen: true }],
  SUSPENDED: [
    { to: 'IN_PROGRESS', permission: 'update' },
    { to: 'CLOSED', permission: 'close' },
    { to: 'REJECTED', permission: 'update' }
  ],
  REJECTED: [
    { to: 'IN_PROGRESS', permission: 'update' },
    { to: 'CLOSED', permission: 'close' }
  ]
}

/** 判定 from→to 是否为合法转移；不合法返回 undefined。 */
export function findBugTransition(from: BugStatus, to: BugStatus): BugStatusTransition | undefined {
  return BUG_STATUS_TRANSITIONS[from].find(t => t.to === to)
}

// ─── 严重度排序权重（labels 走前端 i18n，不在 shared 里硬编码中文；见 TestCaseStatus 惯例） ──

/** 严重度排序权重：数字越小越严重（用于列表默认排序 / 看板列排序）。 */
export const BUG_SEVERITY_RANK: Record<BugSeverity, number> = {
  BLOCKER: 0,
  CRITICAL: 1,
  MAJOR: 2,
  MINOR: 3,
  TRIVIAL: 4
}

// ─── 字段系统（内置字段 + 值库，见 ADR 0005 / CONTEXT.md 缺陷域） ──────────

export const BUG_FIELD_TYPES = [
  'text',
  'textarea',
  'select',
  'multiSelect',
  'user',
  'version',
  'date',
  'number',
  'attachment'
] as const

export type BugFieldType = (typeof BUG_FIELD_TYPES)[number]

/** 有值库的字段类型（需要维护 options）。 */
export function hasOptionLibrary(type: BugFieldType): boolean {
  return type === 'select' || type === 'multiSelect'
}

/** 内置字段 key：结构固定不可删（locked=true）。模块/Tag 内置但值库可编辑。 */
export const BUG_BUILTIN_FIELD_KEYS = [
  'title',
  'severity',
  'priority',
  'description',
  'reproSteps',
  'modules',
  'tags',
  'assignee',
  'foundInVersion',
  'environment',
  'attachments'
] as const

export type BugBuiltinFieldKey = (typeof BUG_BUILTIN_FIELD_KEYS)[number]

/** 项目创建时 seed 的内置字段定义（结构，不含 id/workspaceId，由 seed 逻辑补全）。 */
export interface BugFieldSeed {
  key: BugBuiltinFieldKey
  label: string
  type: BugFieldType
  required: boolean
  description?: string
  placeholder?: string
  defaultValue?: string
  options?: { id: string; label: string }[]
  allowCustomValues?: boolean
}

export const BUG_BUILTIN_FIELD_SEEDS: BugFieldSeed[] = [
  {
    key: 'title',
    label: '标题',
    type: 'text',
    required: true,
    description: '一句话描述这个问题，便于列表快速识别。',
    placeholder: '如：登录页勾选记住我无效'
  },
  {
    key: 'severity',
    label: '严重程度',
    type: 'select',
    required: true,
    description: '缺陷对系统的客观影响程度，与优先级是两个维度。',
    defaultValue: 'MAJOR',
    // 真实 enum 列（BugSeverity），选项来自 BUG_SEVERITIES 固定常量，
    // 不落 BugFieldOption 值库（不是任意值，无需值库管理）。
    allowCustomValues: false
  },
  {
    key: 'priority',
    label: '优先级',
    type: 'select',
    required: true,
    description: '修复的紧急程度，用于排期。',
    defaultValue: 'P1',
    // 真实 enum 列（BugPriority），选项来自 BUG_PRIORITIES 固定常量。
    allowCustomValues: false
  },
  {
    key: 'description',
    label: '描述',
    type: 'textarea',
    required: false,
    description: '问题现象的详细说明。',
    placeholder: '详细说明问题现象'
  },
  {
    key: 'reproSteps',
    label: '复现步骤',
    type: 'textarea',
    required: false,
    description: '逐步操作 + 预期结果与实际结果。',
    placeholder: '1. \n2. \n3. \n预期：\n实际：'
  },
  {
    key: 'modules',
    label: '模块',
    type: 'multiSelect',
    required: false,
    description: '缺陷所属的功能模块，可多选或现场新建；值库在字段管理里维护。',
    allowCustomValues: true,
    options: []
  },
  {
    key: 'tags',
    label: 'Tag',
    type: 'multiSelect',
    required: false,
    description: '自由标签，可多选或现场新建；值库在字段管理里维护。',
    allowCustomValues: true,
    options: []
  },
  {
    key: 'assignee',
    label: '指派给',
    type: 'user',
    required: false,
    description: '负责修复该缺陷的开发人员。',
    placeholder: '选择开发人员'
  },
  {
    key: 'foundInVersion',
    label: '发现版本',
    type: 'version',
    required: false,
    description: '缺陷在哪个版本被发现。',
    placeholder: '如 v2.3.0'
  },
  {
    key: 'environment',
    label: '环境',
    type: 'text',
    required: false,
    description: '操作系统 / 浏览器 / 设备等运行环境。',
    placeholder: '如 macOS 14 / Chrome 120'
  },
  {
    key: 'attachments',
    label: '附件',
    type: 'attachment',
    required: false,
    description: '上传截图 / 日志 / 录屏，便于开发定位问题。'
  }
]
