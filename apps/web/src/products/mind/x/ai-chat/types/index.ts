// @ts-nocheck — desktop mirror of cloud AI chat; runtime bridged via bridge.tsx
/**
 * AIchatV2 类型定义
 *
 * 完全使用 Vercel AI SDK 的标准类型
 */

import type { UIMessage } from "@ai-sdk/react"

// ============================================
// 基础类型
// ============================================

/**
 * 附件类型（支持图像）
 */
export interface Attachment {
  id?: string
  type: "image"
  name: string
  dataUrl: string
}

/**
 * 用例确认项
 */
export interface CaseConfirmItem {
  caseId: string
  caseText: string
  steps?: string[]
  operation: "add" | "update" | "delete"
  action?: "accept" | "reject"
  feedback?: string
  /** AI 预分配的短 ID（仅 add_cases 时可能存在） */
  preAssignedShortId?: string
}

/**
 * 用例确认结果
 */
export interface CaseConfirmResult {
  accepted: Array<{
    caseId: string
    caseText: string
    steps?: string[]
  }>
  rejected: Array<{
    caseId: string
    caseText: string
    feedback?: string
  }>
}

// ============================================
// 工具系统类型 - 替代 Record<string, any>
// ============================================

/**
 * 工具参数类型 - 替代 Record<string, any>
 */
export type ToolArgs = Record<string, unknown>

/**
 * 工具输入类型定义
 */
export interface AddCasesInput {
  moduleId: string
  cases: Array<{ case: string; steps?: string[] }>
}

export interface UpdateCasesInput {
  updates: Array<{ caseId: string; case?: string; steps?: string[] }>
}

export interface DeleteCasesInput {
  caseIds: string[]
}

export interface AddModuleInput {
  modules: Array<{ name: string }>
  parentModuleId?: string
}

export interface UpdateModuleInput {
  updates: Array<{ moduleId: string; name?: string }>
}

export interface DeleteModuleInput {
  moduleIds: string[]
}

export interface SearchCasesInput {
  query: string
  moduleId?: string
}

export interface GetModuleCasesInput {
  moduleId: string
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface ListModulesInput {
  // 无参数
}

// ============================================
// SDK 相关类型
// ============================================

/**
 * SDK sendMessage 参数类型
 */
export interface SendMessageParams {
  text: string
  files?: Array<{
    type: "file"
    filename: string
    mediaType: string
    url: string
  }>
  metadata?: Record<string, unknown>
}

/**
 * SDK addToolOutput 参数类型（AI SDK 6 中 addToolResult 已废弃，使用 addToolOutput 替代）
 * 使用联合类型以匹配 SDK 的定义
 */
export type AddToolOutputParams =
  | {
      tool: string
      toolCallId: string
      output: unknown
    }
  | {
      state: "output-error"
      tool: string
      toolCallId: string
      errorText: string
    }

// ============================================
// UIMessage 扩展类型
// ============================================

/**
 * Token 使用量（内部使用）
 */
export interface TokenUsage {
  input: number
  output: number
  total: number
}

/**
 * SDK 返回的 Token 使用量格式
 */
export interface SDKTokenUsage {
  inputTokens?: number
  outputTokens?: number
  totalTokens?: number
}

/**
 * RAG 检索资源类型
 */
export interface RetrieverResource {
  chunk_id?: string
  position?: string
  document_name: string
  data_source_name?: string
  data_source_type: "feishu_document" | "knowledge_base"
  block_id?: string
  score?: number
  content?: string
}

/**
 * 扩展 UIMessage 以支持 metadata
 */
export interface UIMessageWithMetadata extends UIMessage {
  metadata?: {
    retriever_resources?: RetrieverResource[]
    totalUsage?: SDKTokenUsage
    modelId?: string
    responseStartedAt?: number
    responseDurationMs?: number
    turnStartedAt?: number
    turnDurationMs?: number
    [key: string]: unknown
  }
}

/**
 * 支持错误类型的 MessagePart
 */
export interface ErrorMessagePart {
  type: "error"
  errorText?: string
  error?: string
}

/**
 * 通用消息部分类型（用于类型断言）
 */
export interface GenericMessagePart {
  type: string
  text?: string
  image?: string
  url?: string
  mediaType?: string
  filename?: string
  errorText?: string
  error?: string
  [key: string]: unknown
}

/**
 * Prompt 类型定义
 */
export interface Prompt {
  id: string
  title: string
  content: string
  isEnabled: boolean
  isPublic?: boolean
  user?: {
    name: string
    email?: string | null
    avatar?: string | null
  }
}

/**
 * 工具执行结果扩展（用于用例操作）
 */
export interface CaseOperationResult {
  success: boolean
  data?: unknown
  error?: string
  duration?: number
  total?: number
  acceptedCount?: number
  rejectedCount?: number
  caseCount?: number
  deletedCount?: number
  successCount?: number
  failedCount?: number
  moduleId?: string
  rejected?: Array<{
    caseId: string
    caseText: string
    feedback?: string
  }>
  results?: Array<{
    caseId: string
    success: boolean
    error?: string
  }>
}
