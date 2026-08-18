// @ts-nocheck — dormant AI chat / MCP module (bridge.tsx flattens to no-op)
/**
 * ToolUIRenderer — 遍历 pending 队列, 渲染每个 pending tool call 对应的 UI.
 *
 * 工作流:
 *   1. dispatcher 收到 tool call → enqueueToolUICall() 把它推入队列
 *   2. 本组件 useSyncExternalStore 订阅队列变化 → 重渲染
 *   3. 对每项找对应 handler, 调 handler.render({ args, respond, skip })
 *   4. 用户提交 → respond(output) → runtime.addToolOutput + completeToolUICall(toolCallId)
 *
 * 注意: handler.render 通常是个 Panel 组件, 同一时刻可能多个 pending (理论上不会,
 * 但 SDK 一轮里多次 tool-call 串行也支持). 我们渲染所有 pending, 多个面板纵向堆叠.
 */

import { useSyncExternalStore, useCallback, type ReactNode } from 'react'
import {
  completeToolUICall,
  getToolUIHandler,
  getToolUIPending,
  subscribeToolUIPending,
  type PendingToolUICall
} from './ToolUIRegistry'
import { getModuleAIChatRuntime } from './AIChatRuntimeContext'
import { logger } from '@zoeymind/logger'

interface ToolUIItemProps {
  call: PendingToolUICall
}

function ToolUIItem({ call }: ToolUIItemProps): ReactNode {
  const handler = getToolUIHandler(call.toolName)

  const respond = useCallback(
    (output: unknown) => {
      const runtime = getModuleAIChatRuntime()
      if (!runtime) {
        logger.warn('[ToolUIRenderer] runtime 未初始化, 无法回传 respond', {
          toolName: call.toolName,
          toolCallId: call.toolCallId
        })
        return
      }
      const serialized = handler?.serializeOutput
        ? handler.serializeOutput(output)
        : JSON.stringify(output)
      runtime.addToolOutput({
        tool: call.toolName,
        toolCallId: call.toolCallId,
        output: serialized
      })
      completeToolUICall(call.toolCallId)
    },
    [call.toolCallId, call.toolName, handler]
  )

  const dismiss = useCallback(() => {
    completeToolUICall(call.toolCallId)
  }, [call.toolCallId])

  const skip = useCallback(() => {
    if (!handler?.skipResponse) return
    respond(handler.skipResponse())
  }, [handler, respond])

  if (!handler) {
    logger.warn('[ToolUIRenderer] 找不到 handler', { toolName: call.toolName })
    return null
  }

  const args = handler.parseArgs ? handler.parseArgs(call.input, call.toolName) : call.input

  return (
    <div key={call.toolCallId} data-tool-call-id={call.toolCallId}>
      {handler.render({
        toolCallId: call.toolCallId,
        toolName: call.toolName,
        args,
        respond,
        dismiss,
        skip: handler.skipResponse ? skip : undefined
      })}
    </div>
  )
}
export function ToolUIRenderer(): ReactNode {
  const pending = useSyncExternalStore(subscribeToolUIPending, getToolUIPending, getToolUIPending)

  if (pending.length === 0) return null

  return (
    <>
      {pending.map(call => (
        <ToolUIItem key={call.toolCallId} call={call} />
      ))}
    </>
  )
}