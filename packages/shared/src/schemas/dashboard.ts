/**
 * 质量仪表盘契约（前后端共用）。
 *
 * DashboardFilter → 后端 tRPC input（Zod）
 * DashboardData   → 后端 tRPC output（TypeScript interface，走 tRPC 类型推导）
 *
 * Panel 只依赖此文件定义的形状；换 seam（mock → tRPC）时保持契约不变。
 */
import { z } from 'zod'

// 4 维筛选 —— 时间窗 / 版本 / 责任人 / 模块。
export const DashboardFilterSchema = z.object({
  workspaceId: z.string().cuid(),
  organizationId: z.string(),
  rangeDays: z.number().int().min(1).max(730),
  versionId: z.string().nullable().default(null),
  assigneeId: z.string().nullable().default(null),
  moduleId: z.string().nullable().default(null)
})

export type DashboardFilter = z.infer<typeof DashboardFilterSchema>

// getFilters 入参 —— 只用 workspaceId + organizationId 拉下拉选项。
export const DashboardScopeSchema = z.object({
  workspaceId: z.string().cuid(),
  organizationId: z.string()
})

export type DashboardScope = z.infer<typeof DashboardScopeSchema>

// ── output types ────────────────────────────────────────────────────

// 顶部 KPI 条 —— 一眼看健康度。
export interface DashboardKpi {
  openBugs: number
  /** 与上一周期（前 7 天）比：+N 表示新增更快，-N 表示在还债。 */
  openBugsDelta: number
  weekCreated: number
  weekResolved: number
  /** 平均修复时长（天，一位小数） */
  avgFixDays: number
  /** SUSPENDED 缺陷占全部缺陷比例（0-1） */
  suspendedRate: number
  /** reopenCount>0 的缺陷占比（0-1） */
  reopenRate: number
  /** BLOCKER + CRITICAL 未关闭 */
  blockerOpen: number
}

export interface DashboardBurnupPoint {
  date: string
  open: number
}

export interface DashboardDailyFlow {
  date: string
  created: number
  /** 负值方便正负堆叠柱状 */
  resolved: number
}

export interface DashboardStatusDist {
  status: 'NEW' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED' | 'SUSPENDED' | 'REJECTED'
  label: string
  count: number
  fill: string
}

export interface DashboardBugPulsePoint {
  date: string
  total: number
  unclosed: number
  inProgress: number
  suspended: number
  rejected: number
  regressionFailed: number
}

export interface DashboardSeverityDist {
  severity: 'BLOCKER' | 'CRITICAL' | 'MAJOR' | 'MINOR' | 'TRIVIAL'
  label: string
  count: number
  fill: string
}

export interface DashboardSlaBucket {
  label: string
  count: number
  fill: string
}

export interface DashboardAssigneeLoad {
  userId: string
  userName: string
  user: DashboardUserRef | null
  NEW: number
  IN_PROGRESS: number
  SUSPENDED: number
  RESOLVED: number
  total: number
}

export interface DashboardModuleHotspot {
  moduleId: string
  moduleName: string
  count: number
}

export interface DashboardBugRef {
  id: string
  code: string
  title: string
  status: DashboardStatusDist['status']
  severity: DashboardSeverityDist['severity']
  priority: 'P0' | 'P1' | 'P2' | 'P3'
}

export interface DashboardUserRef {
  id: string
  name: string | null
  email: string | null
  avatar: string | null
}

export interface DashboardAgingBug {
  bug: DashboardBugRef
  ageDays: number
  moduleName: string
  assignee: DashboardUserRef | null
  assigneeName: string
}

export interface DashboardHighSeverityBug {
  bug: DashboardBugRef
  ageDays: number
  moduleName: string
  assignee: DashboardUserRef | null
  assigneeName: string
}

export interface DashboardReopenBug {
  bug: DashboardBugRef
  reopenCount: number
  moduleName: string
  assignee: DashboardUserRef | null
  assigneeName: string
}

export interface DashboardActivity {
  id: string
  actorId: string
  actorName: string
  actorEmail: string | null
  actorAvatar: string | null
  bugId: string
  bugCode: string
  bugTitle: string
  bugStatus: DashboardStatusDist['status']
  bugSeverity: DashboardSeverityDist['severity']
  bugPriority: 'P0' | 'P1' | 'P2' | 'P3'
  type: 'CREATED' | 'STATUS_CHANGED' | 'ASSIGNED' | 'COMMENTED' | 'REOPENED' | 'RESOLVED' | 'CLOSED'
  fromStatus?: DashboardStatusDist['status']
  toStatus?: DashboardStatusDist['status']
  at: string
  relativeTime: string
}

export interface DashboardTestPlan {
  id: string
  name: string
  owner: { id: string; name: string | null; email: string | null; avatar: string | null } | null
  executors: Array<{ id: string; name: string | null; email: string | null; avatar: string | null }>
  ownerName: string
  total: number
  notExecuted: number
  passed: number
  failed: number
  blocked: number
  skipped: number
  /** 已执行占总数（0-100 整数） */
  progress: number
  /** 已执行中通过占比（0-100 整数） */
  passRate: number
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'OVERDUE' | 'AT_RISK'
  dueDate: string | null
}

export interface DashboardExecutionTrendPoint {
  date: string
  passed: number
  failed: number
  blocked: number
}

export interface DashboardIterationTask {
  id: string
  title: string
  status: 'PENDING' | 'ACTIVE' | 'DONE' | 'BLOCKED'
  owners: DashboardUserRef[]
  iteration: string
}

export interface DashboardFilters {
  versions: Array<{ id: string; number: string }>
  users: Array<{ id: string; name: string }>
  modules: Array<{ id: string; name: string }>
}

/**
 * 主 output —— getStats 返回。
 *
 * 所有 panel 数据一次算齐。stale-while-revalidate 由客户端 react-query 承担。
 */
export interface DashboardData {
  filter: DashboardFilter
  kpi: DashboardKpi
  burnup: DashboardBurnupPoint[]
  dailyFlow: DashboardDailyFlow[]
  severity: DashboardSeverityDist[]
  status: DashboardStatusDist[]
  bugPulse: DashboardBugPulsePoint[]
  sla: DashboardSlaBucket[]
  assigneeLoad: DashboardAssigneeLoad[]
  moduleHotspot: DashboardModuleHotspot[]
  aging: DashboardAgingBug[]
  highSeverity: DashboardHighSeverityBug[]
  reopen: DashboardReopenBug[]
  executionTrend: DashboardExecutionTrendPoint[]
  testPlans: DashboardTestPlan[]
  iterationTasks: DashboardIterationTask[]
  activities: DashboardActivity[]
}
