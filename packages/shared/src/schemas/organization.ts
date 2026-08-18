import { z } from 'zod'

// 组织角色
export const OrganizationRoleSchema = z.enum(['OWNER', 'ADMIN', 'MEMBER', 'GUEST'])
export const OrganizationRoles = OrganizationRoleSchema.enum
export type OrganizationRole = z.infer<typeof OrganizationRoleSchema>

// 创建组织 (slug 字段已删, 系统用 id 唯一标识)
export const createOrganizationSchema = z.object({
  name: z.string().min(1, '组织名称不能为空').max(100, '组织名称不能超过100个字符'),
  description: z.string().max(500, '描述不能超过500个字符').optional()
})
export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>

// 更新组织
export const updateOrganizationSchema = z.object({
  organizationId: z.string(),
  name: z.string().min(1, '组织名称不能为空').max(100, '组织名称不能超过100个字符').optional(),
  description: z.string().max(500, '描述不能超过500个字符').optional(),
  avatar: z.string().url('请输入有效的 URL').optional().nullable()
})
export type UpdateOrganizationInput = z.infer<typeof updateOrganizationSchema>

// 配置集成
export const configureIntegrationSchema = z.object({
  organizationId: z.string(),
  type: z.string().min(1, '集成类型不能为空'),
  config: z.record(z.string(), z.unknown()),
  isEnabled: z.boolean().default(true)
})
export type ConfigureIntegrationInput = z.infer<typeof configureIntegrationSchema>

// 移除集成
export const removeIntegrationSchema = z.object({
  integrationId: z.string()
})
export type RemoveIntegrationInput = z.infer<typeof removeIntegrationSchema>

// 切换集成启用状态
export const toggleIntegrationSchema = z.object({
  integrationId: z.string(),
  isEnabled: z.boolean()
})
export type ToggleIntegrationInput = z.infer<typeof toggleIntegrationSchema>

// 获取组织详情 (通过 id, 不再用 slug)
export const getOrganizationSchema = z.object({
  id: z.string().min(1, '组织 ID 不能为空')
})
export type GetOrganizationInput = z.infer<typeof getOrganizationSchema>

// 删除组织
export const deleteOrganizationSchema = z.object({
  organizationId: z.string()
})
export type DeleteOrganizationInput = z.infer<typeof deleteOrganizationSchema>

// 项目通知配置 (workspace.notificationConfig, Prisma Json?)
//
// 模型（两块正交）：
//   1. enabledEvents[]：项目级事件开关（哪些事件触发通知）
//   2. bindings[]：多条 provider 通道（飞书/钉钉/企微/通用 Webhook）
// 触发事件时：若 enabledEvents 包含 → 遍历所有 bindings 全发（无 per-binding 过滤）。

/** 支持的 provider 类型；与 NotificationChannel.id 对齐。 */
export const ProjectBindingProviderSchema = z.enum([
  'feishu-bot',
  'dingtalk-bot',
  'wecom-bot',
  'webhook'
])
export type ProjectBindingProvider = z.infer<typeof ProjectBindingProviderSchema>

/** 项目通知事件枚举 —— 与后端 dispatcher / 前端 EVENT_META 保持一致。 */
export const ProjectNotificationEventSchema = z.enum([
  'BUG_CREATED',
  'TEST_REPORT_PUBLISHED',
  'TEST_PLAN_COMPLETED',
  'ITERATION_RELEASED',
  'ITERATION_ARCHIVED',
  'ITERATION_TASK_STATUS_CHANGED'
])
export type ProjectNotificationEvent = z.infer<typeof ProjectNotificationEventSchema>

/** MVP 阶段实际接入 dispatcher 的事件；前端可据此置灰未接入的事件开关。 */
export const MVP_PROJECT_NOTIFICATION_EVENTS: ProjectNotificationEvent[] = [
  'BUG_CREATED',
  'TEST_REPORT_PUBLISHED',
  'TEST_PLAN_COMPLETED',
  'ITERATION_RELEASED',
  'ITERATION_ARCHIVED',
  'ITERATION_TASK_STATUS_CHANGED'
]

export const ProjectBindingSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(64),
  provider: ProjectBindingProviderSchema,
  url: z.string().min(1).max(2048),
  /** 签名密钥（可选）；企微 provider 忽略。 */
  secret: z.string().max(256).optional()
})
export type ProjectBinding = z.infer<typeof ProjectBindingSchema>

export const WorkspaceNotificationConfigSchema = z.object({
  enabledEvents: z.array(ProjectNotificationEventSchema).default([]),
  bindings: z.array(ProjectBindingSchema).default([])
})
export type WorkspaceNotificationConfig = z.infer<typeof WorkspaceNotificationConfigSchema>

/** 老结构 (2026-07 之前)：{ feishu: { webhookUrl } }。为兼容存量数据保留解析。 */
const LegacyWorkspaceNotificationConfigSchema = z.object({
  feishu: z
    .object({
      webhookUrl: z.string().min(1)
    })
    .optional()
})

const EMPTY_CONFIG: WorkspaceNotificationConfig = {
  enabledEvents: [],
  bindings: []
}

/**
 * 从未知 JSON 安全解析为强类型 config。**总是返回可用 config**（空态视为默认空 config）：
 *  - 新结构 `{ enabledEvents, bindings }` 直接接受
 *  - 老结构 `{ feishu: { webhookUrl } }` 迁移为一条 feishu-bot binding + MVP 事件全开
 *  - null / 无效 / 空 → 空 config
 *
 * 落库时用 `WorkspaceNotificationConfigSchema.parse` 做严格校验。
 */
export function parseWorkspaceNotificationConfig(raw: unknown): WorkspaceNotificationConfig {
  if (raw == null) return EMPTY_CONFIG
  const parsed = WorkspaceNotificationConfigSchema.safeParse(raw)
  if (parsed.success) return parsed.data
  const legacy = LegacyWorkspaceNotificationConfigSchema.safeParse(raw)
  if (legacy.success && legacy.data.feishu?.webhookUrl) {
    return {
      enabledEvents: [...MVP_PROJECT_NOTIFICATION_EVENTS],
      bindings: [
        {
          id: 'legacy-feishu',
          name: '飞书通知（迁移）',
          provider: 'feishu-bot',
          url: legacy.data.feishu.webhookUrl
        }
      ]
    }
  }
  return EMPTY_CONFIG
}
