/** Dispatches the current document tools and the structured question UI. */

import { useCallback, useRef } from "react"
import { logger } from "@zoeymind/logger"
import type { AddToolOutputParams } from "../../ai-chat/types"
import { enqueueToolUICall } from "../../ai-chat/context/ToolUIRegistry"
import type { ChatRuntime } from "./internal/chatRuntime"
import {
  approveCurrentDocumentEdit,
  executeCurrentDocumentPortalTool,
  isCurrentDocumentPortalTool,
} from "@/products/mind/document-portal/current-document-adapter"
import { useAIChatV2Store } from "../../ai-chat/stores/useAIChatV2Store"
import { getDocumentEditApprovalEnabled } from "./useDocumentEditApprovalSetting"
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
  addToolOutput: (params: AddToolOutputParams) => Promise<void>
}

export interface UseToolDispatcherResult {
  onToolCall: (event: { toolCall: ToolCallLike }) => Promise<void>
  toolUsageRef: React.MutableRefObject<Record<string, never>>
  lastReportedRef: React.MutableRefObject<Record<string, never>>
  toolUsageProjectRef: React.MutableRefObject<Record<string, string | undefined>>
}

export function useToolDispatcher({
  addToolOutput,
}: UseToolDispatcherOptions): UseToolDispatcherResult {
  const toolUsageRef = useRef<Record<string, never>>({})
  const lastReportedRef = useRef<Record<string, never>>({})
  const toolUsageProjectRef = useRef<Record<string, string | undefined>>({})

  const consumeInterruptedToolCall = (toolCallId: string): boolean => {
    const interrupted = useAIChatV2Store.getState().interruptedToolCallIds
    if (!interrupted.includes(toolCallId)) return false
    useAIChatV2Store.setState({
      interruptedToolCallIds: interrupted.filter(id => id !== toolCallId),
    })
    return true
  }

  const onToolCall = useCallback<UseToolDispatcherResult["onToolCall"]>(
    async ({ toolCall }) => {
      if ("dynamic" in toolCall && toolCall.dynamic) {
        logger.warn("[useToolDispatcher] 不支持动态工具")
        return
      }
      if (isCurrentDocumentPortalTool(toolCall.toolName)) {
        try {
          const initialInput =
            toolCall.toolName === "edit_current_mindmap"
              ? { ...(toolCall.input as Record<string, unknown>), preview: true }
              : toolCall.input
          const initialOutput = await Promise.resolve(
            executeCurrentDocumentPortalTool(toolCall.toolName, initialInput)
          )
          if (consumeInterruptedToolCall(toolCall.toolCallId)) return
          if (
            toolCall.toolName === "edit_current_mindmap" &&
            initialOutput.success === true &&
            initialOutput.phase === "preview" &&
            (initialOutput.changeSummary as { destructive?: boolean } | undefined)?.destructive
          ) {
            const confirmationToken = initialOutput.confirmationToken
            if (typeof confirmationToken !== "string")
              throw new Error("Destructive edit preview omitted its approval token")
            if (!getDocumentEditApprovalEnabled()) {
              const committed = await approveCurrentDocumentEdit(
                confirmationToken,
                (
                  toolCall.input as {
                    returnView?: { view?: "outline" | "subtree"; maxLines?: number }
                  }
                ).returnView
              )
              await addToolOutput({
                tool: toolCall.toolName,
                toolCallId: toolCall.toolCallId,
                output: committed,
              })
              return
            }
            enqueueToolUICall({
              toolCallId: toolCall.toolCallId,
              toolName: toolCall.toolName,
              input: {
                confirmationToken,
                changeSummary: initialOutput.changeSummary,
                returnView: (toolCall.input as { returnView?: unknown }).returnView,
              },
            })
            return
          }
          const output =
            toolCall.toolName === "edit_current_mindmap"
              ? await Promise.resolve(
                  executeCurrentDocumentPortalTool(toolCall.toolName, toolCall.input)
                )
              : initialOutput
          await addToolOutput({ tool: toolCall.toolName, toolCallId: toolCall.toolCallId, output })
        } catch (error) {
          if (consumeInterruptedToolCall(toolCall.toolCallId)) return
          logger.error("[useToolDispatcher] 当前文档工具执行失败", {
            toolName: toolCall.toolName,
            error,
          })
          await addToolOutput({
            tool: toolCall.toolName,
            toolCallId: toolCall.toolCallId,
            state: "output-error",
            errorText: error instanceof Error ? error.message : String(error),
          })
        }
        return
      }

      if (toolCall.toolName.startsWith("mcp_")) return
      if (
        enqueueToolUICall({
          toolCallId: toolCall.toolCallId,
          toolName: toolCall.toolName,
          input: toolCall.input,
        })
      )
        return
      if (toolCall.toolName === "question") {
        await addToolOutput({
          tool: toolCall.toolName,
          toolCallId: toolCall.toolCallId,
          output: JSON.stringify({ success: false, error: "question 缺少 questions 参数" }),
        })
      }
    },
    [addToolOutput]
  )

  return { onToolCall, toolUsageRef, lastReportedRef, toolUsageProjectRef }
}
