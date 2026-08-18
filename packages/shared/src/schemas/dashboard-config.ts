import { z } from 'zod'

export const DashboardDataSourceKeySchema = z.enum(['bug', 'testPlan', 'testPlanCase'])
export type DashboardDataSourceKey = z.infer<typeof DashboardDataSourceKeySchema>

export const DashboardDatasetKeySchema = z.enum([
  'qualitySummary',
  'burnup',
  'iterationTasks',
  'dailyFlow',
  'severity',
  'status',
  'moduleHotspot',
  'assigneeLoad',
  'sla',
  'executionTrend',
  'testPlans',
  'agingBugs',
  'highSeverityBugs',
  'reopenBugs'
])
export type DashboardDatasetKey = z.infer<typeof DashboardDatasetKeySchema>

export const DashboardFieldTypeSchema = z.enum([
  'string',
  'number',
  'date',
  'enum',
  'user',
  'boolean',
  'percent',
  'bug'
])
export type DashboardFieldType = z.infer<typeof DashboardFieldTypeSchema>

export const DashboardWidgetTypeSchema = z.enum(['builtin', 'metric', 'chart', 'table'])
export type DashboardWidgetType = z.infer<typeof DashboardWidgetTypeSchema>

export const DashboardChartKindSchema = z.enum([
  'bar',
  'horizontalBar',
  'line',
  'area',
  'pie',
  'donut',
  'radialBar'
])
export type DashboardChartKind = z.infer<typeof DashboardChartKindSchema>

export const DashboardAggregateOpSchema = z.enum([
  'count',
  'sum',
  'avg',
  'min',
  'max',
  'median',
  'p90',
  'distinct'
])
export type DashboardAggregateOp = z.infer<typeof DashboardAggregateOpSchema>

export const DashboardFilterOpSchema = z.enum(['eq', 'in'])
export type DashboardFilterOp = z.infer<typeof DashboardFilterOpSchema>

export const DashboardLayoutItemSchema = z.object({
  i: z.string(),
  x: z.number().int().min(0),
  y: z.number().int().min(0),
  w: z.number().int().min(1),
  h: z.number().int().min(1),
  minW: z.number().int().min(1).optional(),
  minH: z.number().int().min(1).optional()
})
export type DashboardLayoutItemConfig = z.infer<typeof DashboardLayoutItemSchema>

export const DashboardResponsiveLayoutsSchema = z.object({
  lg: z.array(DashboardLayoutItemSchema).optional(),
  md: z.array(DashboardLayoutItemSchema).optional(),
  sm: z.array(DashboardLayoutItemSchema).optional(),
  xs: z.array(DashboardLayoutItemSchema).optional(),
  xxs: z.array(DashboardLayoutItemSchema).optional()
})
export type DashboardResponsiveLayoutsConfig = z.infer<typeof DashboardResponsiveLayoutsSchema>

export const DashboardFilterClauseSchema = z.object({
  field: z.string().min(1),
  op: DashboardFilterOpSchema,
  value: z.union([z.string(), z.array(z.string())])
})
export type DashboardFilterClause = z.infer<typeof DashboardFilterClauseSchema>

export const DashboardMetricSpecSchema = z.object({
  op: DashboardAggregateOpSchema,
  field: z.string().min(1).optional(),
  as: z.string().min(1)
})
export type DashboardMetricSpec = z.infer<typeof DashboardMetricSpecSchema>

/**
 * 时间范围：默认按 rangeDays 滚动窗口。
 * 若 rangeStart/rangeEnd 都提供 → 使用绝对区间（ISO 日期）。
 * 兼容旧数据：只有 rangeDays 时按滚动窗口解释。
 */
export const DashboardQueryRangeDaysSchema = z.number().int().min(1).max(730)
export type DashboardQueryRangeDays = z.infer<typeof DashboardQueryRangeDaysSchema>
export const DashboardIsoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}(T[^ ]*)?$/, 'ISO date required')

export const DashboardRawQuerySpecSchema = z.object({
  source: DashboardDataSourceKeySchema,
  rangeDays: DashboardQueryRangeDaysSchema.default(30),
  rangeStart: DashboardIsoDateSchema.optional(),
  rangeEnd: DashboardIsoDateSchema.optional(),
  filters: z.array(DashboardFilterClauseSchema).default([]),
  groupBy: z.array(z.string().min(1)).default([]),
  metrics: z.array(DashboardMetricSpecSchema).min(1),
  sort: z
    .array(z.object({ field: z.string().min(1), direction: z.enum(['asc', 'desc']) }))
    .default([]),
  limit: z.number().int().min(1).max(200).default(10)
})
export type DashboardRawQuerySpec = z.infer<typeof DashboardRawQuerySpecSchema>

export const DashboardDatasetQuerySpecSchema = z.object({
  dataset: DashboardDatasetKeySchema,
  rangeDays: DashboardQueryRangeDaysSchema.default(30),
  rangeStart: DashboardIsoDateSchema.optional(),
  rangeEnd: DashboardIsoDateSchema.optional(),
  sort: z
    .array(z.object({ field: z.string().min(1), direction: z.enum(['asc', 'desc']) }))
    .default([]),
  limit: z.number().int().min(1).max(200).default(10)
})
export type DashboardDatasetQuerySpec = z.infer<typeof DashboardDatasetQuerySpecSchema>

export const DashboardQuerySpecSchema = z.union([
  DashboardRawQuerySpecSchema,
  DashboardDatasetQuerySpecSchema
])
export type DashboardQuerySpec = z.infer<typeof DashboardQuerySpecSchema>

export const DashboardWidgetQueryBindingSchema = z.object({
  key: z.string().regex(/^[a-z][a-zA-Z0-9_]*$/),
  label: z.string().min(1).max(40).optional(),
  query: DashboardQuerySpecSchema
})
export type DashboardWidgetQueryBinding = z.infer<typeof DashboardWidgetQueryBindingSchema>

export const DashboardStoredQuerySchema = z.union([
  DashboardQuerySpecSchema,
  z.object({ bindings: z.array(DashboardWidgetQueryBindingSchema).min(1).max(6) })
])
export type DashboardStoredQuery = z.infer<typeof DashboardStoredQuerySchema>

export const DashboardFieldFormatSchema = z.enum([
  'auto',
  'text',
  'number',
  'percent',
  'date',
  'datetime',
  'badge',
  'user',
  'bug',
  'progress',
  'boolean'
])
export type DashboardFieldFormat = z.infer<typeof DashboardFieldFormatSchema>

export const DashboardFieldBindingSchema = z.object({
  field: z.string().min(1),
  labelKey: z.string().optional(),
  format: DashboardFieldFormatSchema.default('auto')
})
export type DashboardFieldBinding = z.infer<typeof DashboardFieldBindingSchema>

export const DashboardChartSeriesSchema = z.object({
  queryKey: z.string().min(1),
  field: z.string().min(1),
  label: z.string().max(40).optional(),
  color: z.string().max(80).optional()
})
export type DashboardChartSeries = z.infer<typeof DashboardChartSeriesSchema>

export const DashboardWidgetViewSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('builtin'), builtinKey: z.string().min(1) }),
  z.object({
    kind: z.literal('metric'),
    primaryMetric: z.string().min(1),
    queryKey: z.string().optional(),
    format: z.enum(['number', 'percent']).default('number')
  }),
  z.object({
    kind: z.literal('summary'),
    columns: z.number().int().min(1).max(6).default(3),
    queryKey: z.string().optional()
  }),
  z.object({
    kind: z.literal('chart'),
    chart: DashboardChartKindSchema,
    x: z.string().min(1),
    y: z.union([z.string().min(1), z.array(z.string().min(1)).min(1).max(6)]),
    series: z.array(DashboardChartSeriesSchema).min(1).max(6).optional(),
    stacked: z.boolean().default(false),
    orientation: z.enum(['vertical', 'horizontal']).optional(),
    curve: z.enum(['linear', 'monotone', 'step']).optional(),
    showLegend: z.boolean().optional(),
    showGrid: z.boolean().optional(),
    thresholds: z
      .array(
        z.object({
          value: z.number(),
          label: z.string().max(40).optional(),
          color: z.string().max(40).optional(),
          strokeDasharray: z.string().max(20).optional()
        })
      )
      .max(3)
      .optional()
  }),
  z.object({
    kind: z.literal('table'),
    queryKey: z.string().optional(),
    columns: z
      .array(z.union([z.string().min(1), DashboardFieldBindingSchema]))
      .min(1)
      .max(8)
  }),
  z.object({
    kind: z.literal('tabs'),
    tabs: z
      .array(
        z.object({
          key: z.string().min(1),
          labelKey: z.string().min(1),
          dataset: DashboardDatasetKeySchema,
          columns: z.array(DashboardFieldBindingSchema).min(1).max(8)
        })
      )
      .min(1)
      .max(5)
  })
])
export type DashboardWidgetViewConfig = z.infer<typeof DashboardWidgetViewSchema>

export const DashboardWidgetConfigSchema = z.object({
  id: z.string().cuid(),
  dashboardId: z.string().cuid(),
  type: DashboardWidgetTypeSchema,
  title: z.string().min(1).max(80),
  layout: DashboardResponsiveLayoutsSchema,
  query: DashboardQuerySpecSchema.nullable(),
  queries: z.array(DashboardWidgetQueryBindingSchema).max(6),
  view: DashboardWidgetViewSchema,
  createdAt: z.string(),
  updatedAt: z.string()
})
export type DashboardWidgetConfig = z.infer<typeof DashboardWidgetConfigSchema>

export const DashboardConfigSchema = z.object({
  id: z.string().cuid(),
  workspaceId: z.string().cuid(),
  name: z.string(),
  isDefault: z.boolean(),
  widgets: z.array(DashboardWidgetConfigSchema),
  createdAt: z.string(),
  updatedAt: z.string()
})
export type DashboardConfig = z.infer<typeof DashboardConfigSchema>

export const DashboardFieldDefSchema = z.object({
  key: z.string(),
  labelKey: z.string(),
  type: DashboardFieldTypeSchema,
  filterable: z.boolean(),
  groupable: z.boolean(),
  aggregatable: z.boolean(),
  enumOptions: z.array(z.object({ value: z.string(), labelKey: z.string() })).optional()
})
export type DashboardFieldDef = z.infer<typeof DashboardFieldDefSchema>

export const DashboardDataSourceCatalogSchema = z.object({
  key: DashboardDataSourceKeySchema,
  labelKey: z.string(),
  fields: z.array(DashboardFieldDefSchema)
})
export type DashboardDataSourceCatalog = z.infer<typeof DashboardDataSourceCatalogSchema>

export const DashboardUserValueSchema = z.object({
  id: z.string(),
  name: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  avatar: z.string().nullable().optional()
})
export type DashboardUserValue = z.infer<typeof DashboardUserValueSchema>

export const DashboardBugValueSchema = z.object({
  id: z.string(),
  code: z.string(),
  title: z.string(),
  status: z.string().optional(),
  severity: z.string().optional(),
  priority: z.string().optional()
})
export type DashboardBugValue = z.infer<typeof DashboardBugValueSchema>

export const DashboardResultValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
  DashboardUserValueSchema,
  z.array(DashboardUserValueSchema),
  DashboardBugValueSchema
])
export type DashboardResultValue = z.infer<typeof DashboardResultValueSchema>

export const DashboardQueryResultSchema = z.object({
  columns: z.array(
    z.object({ key: z.string(), label: z.string(), type: DashboardFieldTypeSchema })
  ),
  rows: z.array(z.record(z.string(), DashboardResultValueSchema))
})
export type DashboardQueryResult = z.infer<typeof DashboardQueryResultSchema>

export const DashboardScopeInputSchema = z.object({
  workspaceId: z.string().cuid(),
  organizationId: z.string()
})

export const DashboardListItemSchema = z.object({
  id: z.string().cuid(),
  name: z.string(),
  isDefault: z.boolean(),
  widgetCount: z.number().int().min(0),
  createdAt: z.string(),
  updatedAt: z.string()
})
export type DashboardListItem = z.infer<typeof DashboardListItemSchema>

export const DashboardGetInputSchema = DashboardScopeInputSchema.extend({
  dashboardId: z.string().cuid().optional()
})
export const DashboardCreateInputSchema = DashboardScopeInputSchema.extend({
  name: z.string().min(1).max(60),
  seedDefaults: z.boolean().default(false)
})
export const DashboardDuplicateInputSchema = DashboardScopeInputSchema.extend({
  dashboardId: z.string().cuid(),
  name: z.string().min(1).max(60).optional()
})
export const DashboardRenameInputSchema = DashboardScopeInputSchema.extend({
  dashboardId: z.string().cuid(),
  name: z.string().min(1).max(60)
})
export const DashboardDeleteInputSchema = DashboardScopeInputSchema.extend({
  dashboardId: z.string().cuid()
})
export const DashboardSetDefaultInputSchema = DashboardScopeInputSchema.extend({
  dashboardId: z.string().cuid()
})

export const DashboardWidgetInputSchema = z.object({
  dashboardId: z.string().cuid(),
  workspaceId: z.string().cuid(),
  organizationId: z.string(),
  type: DashboardWidgetTypeSchema,
  title: z.string().min(1).max(80),
  layout: DashboardResponsiveLayoutsSchema,
  query: DashboardQuerySpecSchema.nullable(),
  queries: z.array(DashboardWidgetQueryBindingSchema).min(1).max(6).optional(),
  view: DashboardWidgetViewSchema
})

export const DashboardUpdateWidgetInputSchema = DashboardWidgetInputSchema.extend({
  id: z.string().cuid()
})

export const DashboardUpdateLayoutsInputSchema = DashboardScopeInputSchema.extend({
  dashboardId: z.string().cuid(),
  layouts: DashboardResponsiveLayoutsSchema
})

export const DashboardWidgetDataInputSchema = z.object({
  workspaceId: z.string().cuid(),
  organizationId: z.string(),
  widgetId: z.string().cuid(),
  dataset: DashboardDatasetKeySchema.optional(),
  queryKey: z.string().min(1).optional()
})
