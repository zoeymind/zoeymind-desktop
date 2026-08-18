import { z } from 'zod'

// Health Check Schema - 简化版，不泄露敏感信息
export const HealthCheckResponseSchema = z.object({
  status: z.string(),
  timestamp: z.string()
})

// Analytics Schemas
export const AnalyticsEventSchema = z
  .object({
    event: z.string().min(1, '事件名称不能为空').max(255, '事件名称不能超过255个字符'),
    timestamp: z.string().optional()
    // 允许任意额外字段作为客户端负载
  })
  .passthrough()

export const AnalyticsResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  timestamp: z.string(),
  webhook_sent: z.boolean()
})

// Error Response Schema
export const ErrorResponseSchema = z.object({
  error: z.boolean(),
  message: z.string(),
  code: z.string(),
  details: z.string().optional(),
  timestamp: z.string().optional()
})

// Deprecated API Response Schema
export const DeprecatedApiResponseSchema = z.object({
  error: z.boolean(),
  message: z.string(),
  webhook_url: z.string(),
  code: z.string()
})
