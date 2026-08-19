// @ts-nocheck — desktop mirror of cloud AI chat; runtime bridged via bridge.tsx
/**
 * useToolDispatcher — 把 useChat 的 onToolCall 拆出来.
 *
 * 工具分发顺序 (与原 useAIChat.ts 一致):
 *   1. 动态工具 → 不支持, 跳过
 *   2. mcp_* 前缀 → 后端 MCP execute, 跳过
 *   3. 后端 execute 工具 (web_search/web_fetch/query_knowledge_bases 等) → 跳过
 *   4. question → 弹出 SimpleAskUserPanel
 *   5. add_cases / update_cases / delete_cases 且 reviewEnabled → 弹出用例确认面板
 *   6. 其它 (思维导图 CRUD) → 走 toolExecutor.execute
 */

import { useCallback, useRef } from 'react'
import { useAIChatV2Store } from '../../ai-chat/stores/useAIChatV2Store'
import { logger } from '@zoeymind/logger'
import { toolExecutor } from '../../ai-chat/tools/executor'
import {
  bindPreAssignedIds,
  cacheToolResult,
  toModelOutput,
  type ExecutionResult
} from '../../ai-chat/tools/types'
import type { AddToolOutputParams, ToolArgs } from '../../ai-chat/types'
import { waitForMindMapInstance } from './internal/waitForMindMap'
import { resolveToolInput } from './internal/resolveToolInput'
import { enqueueToolUICall } from '../../ai-chat/context/ToolUIRegistry'
import {
  type ToolUsageSummary,
  createEmptyToolUsageSummary,
  calculateOperationDelta
} from './internal/toolUsageRecorder'
import { useAnalytics, ANALYTICS_EVENTS } from '@/shared/app-shared'
import type { ChatRuntime } from './internal/chatRuntime'

/** AI SDK 6 的 ToolCall 形态: 我们只用 toolName / toolCallId / input / dynamic */
interface ToolCallLike {
  toolName: string
  toolCallId: string
  input: unknown
  dynamic?: boolean
}

interface UseToolDispatcherOptions {
  runtime: ChatRuntime
  /** useChat 返回的 addToolOutput, 透传给所有分支用 */
  addToolOutput: (params: AddToolOutputParams) => void
}

export interface UseToolDispatcherResult {
  /** 直接给 useChat({ onToolCall }) 用 */
  onToolCall: (event: { toolCall: ToolCallLike }) => Promise<void>
  /** 工具调用累计, 由 useAIChat 在 unload / conversation 切换时上报 */
  toolUsageRef: React.MutableRefObject<Record<string, ToolUsageSummary>>
  /** 已上报的工具调用累计, 防重复 */
  lastReportedRef: React.MutableRefObject<Record<string, ToolUsageSummary>>
  /** 工具调用所属 workspaceId, 跟随 conversationId */
  toolUsageProjectRef: React.MutableRefObject<Record<string, string | undefined>>
}

export function useToolDispatcher({
  runtime,
  addToolOutput
}: UseToolDispatcherOptions): UseToolDispatcherResult {
  const { trackEvent } = useAnalytics()
  const toolUsageRef = useRef<Record<string, ToolUsageSummary>>({})
  const lastReportedRef = useRef<Record<string, ToolUsageSummary>>({})
  const toolUsageProjectRef = useRef<Record<string, string | undefined>>({})

  const recordToolUsage = useCallback(
    (toolName: string, args: ToolArgs, result: ExecutionResult, currentProjectId?: string) => {
      if (!result.success) return
      const conversationId = useAIChatV2Store.getState().currentConversationId
      if (!conversationId) return

      const summary = toolUsageRef.current[conversationId] ?? createEmptyToolUsageSummary()
      const delta = calculateOperationDelta(toolName, args, result)

      summary.toolCount += 1
      summary.moduleAdded += delta.moduleAdded
      summary.moduleUpdated += delta.moduleUpdated
      summary.moduleDeleted += delta.moduleDeleted
      summary.caseAdded += delta.caseAdded
      summary.caseUpdated += delta.caseUpdated
      summary.caseDeleted += delta.caseDeleted

      toolUsageRef.current[conversationId] = summary
      toolUsageProjectRef.current[conversationId] = currentProjectId

      // 防抖上报: 每次成功都触发一次累计上报, lastReported 用于避免后端重复统计
      const last = lastReportedRef.current[conversationId]
      const diff = {
        toolCount: summary.toolCount - (last?.toolCount ?? 0),
        moduleAdded: summary.moduleAdded - (last?.moduleAdded ?? 0),
        moduleUpdated: summary.moduleUpdated - (last?.moduleUpdated ?? 0),
        moduleDeleted: summary.moduleDeleted - (last?.moduleDeleted ?? 0),
        caseAdded: summary.caseAdded - (last?.caseAdded ?? 0),
        caseUpdated: summary.caseUpdated - (last?.caseUpdated ?? 0),
        caseDeleted: summary.caseDeleted - (last?.caseDeleted ?? 0)
      }
      if (diff.toolCount <= 0) return

      lastReportedRef.current[conversationId] = { ...summary }
      void trackEvent(ANALYTICS_EVENTS.AI_TOOL_USAGE_SUMMARY, {
        conversation_id: conversationId,
        project_id: currentProjectId,
        tool_name: toolName,
        delta_tool_count: diff.toolCount,
        delta_module_added: diff.moduleAdded,
        delta_module_updated: diff.moduleUpdated,
        delta_module_deleted: diff.moduleDeleted,
        delta_case_added: diff.caseAdded,
        delta_case_updated: diff.caseUpdated,
        delta_case_deleted: diff.caseDeleted
      }).catch(error => {
        logger.error('[useToolDispatcher] 工具调用埋点上报失败', { error })
      })
    },
    [trackEvent]
  )

  const onToolCall = useCallback<UseToolDispatcherResult['onToolCall']>(
    async ({ toolCall }) => {
      // 1. 动态工具
      if ('dynamic' in toolCall && toolCall.dynamic) {
        logger.warn('[useToolDispatcher] 不支持动态工具')
        return
      }

      // 2. MCP 工具 (后端 streamText.tools 注入, AI SDK 自动 execute)
      if (toolCall.toolName.startsWith('mcp_')) return

      // 3. 后端 execute 工具
      const backendTools = new Set([
        'read_feishu_document',
        'search_feishu_documents',
        'query_knowledge_bases',
        'web_search',
        'web_fetch',
        'get_figma_metadata',
        'get_figma_data',
        'get_figma_image'
      ])
      if (backendTools.has(toolCall.toolName)) return

      // 4. UI 接管 (question / case-confirm 等通过 useToolUI 声明的工具)
      //    - shouldRender 通过 → 入队, ToolUIRenderer 渲染对应 panel, 用户提交后 respond/dismiss
      //    - shouldRender false / 未注册 → 继续 fall through 到默认执行
      if (
        enqueueToolUICall({
          toolCallId: toolCall.toolCallId,
          toolName: toolCall.toolName,
          input: toolCall.input
        })
      ) {
        return
      }

      // 5. question 工具没注册 UI 但没数据 → 默认报错 (兜底, 一般不会触发)
      if (toolCall.toolName === 'question') {
        addToolOutput({
          tool: toolCall.toolName,
          toolCallId: toolCall.toolCallId,
          output: JSON.stringify({ success: false, error: 'question 缺少 questions 参数' })
        })
        return
      }

      // 6. 思维导图 CRUD (走 toolExecutor)
      const currentMindMap = await waitForMindMapInstance()
      if (!currentMindMap) {
        logger.error('[useToolDispatcher] MindMap 实例不存在')
        addToolOutput({
          tool: toolCall.toolName,
          toolCallId: toolCall.toolCallId,
          state: 'output-error',
          errorText: 'MindMap 实例不存在'
        })
        return
      }

      const toolName = toolCall.toolName
      const rawInput = toolCall.input as ToolArgs
      const idMapper = runtime.mindmapContextManager.current?.idMapper

      if (!idMapper) {
        logger.error('[useToolDispatcher] idMapper 不存在')
        addToolOutput({
          tool: toolName,
          toolCallId: toolCall.toolCallId,
          state: 'output-error',
          errorText: 'ID 映射器未初始化'
        })
        return
      }

      try {
        const { resolved, preAssignedIds } = resolveToolInput(
          toolName,
          rawInput as Record<string, unknown>,
          idMapper
        )

        const result = await toolExecutor.execute(toolName, resolved, currentMindMap, idMapper)

        bindPreAssignedIds(toolName, result, preAssignedIds, idMapper)

        recordToolUsage(
          toolName,
          rawInput,
          result,
          (currentMindMap as { workspaceId?: string }).workspaceId
        )

        cacheToolResult(toolCall.toolCallId, result)

        addToolOutput({
          tool: toolName,
          toolCallId: toolCall.toolCallId,
          output: toModelOutput(result)
        })
      } catch (error) {
        logger.error('[useToolDispatcher] 工具执行失败', {
          toolName,
          error
        })

        addToolOutput({
          tool: toolName,
          toolCallId: toolCall.toolCallId,
          state: 'output-error',
          errorText: error instanceof Error ? error.message : String(error)
        })
      }
    },
    [runtime, addToolOutput, recordToolUsage]
  )

  return { onToolCall, toolUsageRef, lastReportedRef, toolUsageProjectRef }
}
