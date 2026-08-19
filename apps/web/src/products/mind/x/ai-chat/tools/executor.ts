// @ts-nocheck — desktop mirror of cloud AI chat; runtime bridged via bridge.tsx
/**
 * 工具执行队列管理器
 *
 * 支持：
 * 1. 并行执行独立工具（查询类）
 * 2. 串行执行修改工具（避免冲突）
 * 3. 自动检测工具依赖关系
 * 4. 同轮引用：支持在前置工具执行完毕后 resolve 预分配 ID
 */

import type MindMap from 'simple-mind-map'
import type { ExecutionResult } from './types'
import { logger } from '@zoeymind/logger'
import { executeToolCall } from './registry'
import type { SessionIdMapper } from './session-id-mapper'
import { SessionIdMapper as SessionIdMapperClass } from './session-id-mapper'

// 只读工具（可以并行执行）
const READ_ONLY_TOOLS = new Set(['list_modules', 'get_module_cases', 'search_cases'])

// 修改工具（需要串行执行）
const WRITE_TOOLS = new Set([
  'add_cases',
  'update_cases',
  'delete_cases',
  'add_module',
  'update_module',
  'delete_module',
  'ensure_cases'
])

interface QueuedTool {
  toolName: string
  args: Record<string, unknown>
  mindMap: MindMap
  idMapper: SessionIdMapper
  resolve: (result: ExecutionResult) => void
  reject: (error: Error) => void
}

/**
 * 替换工具参数中的占位符为真实 UUID（同轮引用支持）
 */
function resolvePlaceholders(
  args: Record<string, unknown>,
  mapper: SessionIdMapper
): Record<string, unknown> {
  const resolveValue = (value: unknown): unknown => {
    if (typeof value === 'string' && SessionIdMapperClass.isPlaceholder(value)) {
      const shortId = SessionIdMapperClass.extractFromPlaceholder(value)
      if (!shortId) return value

      // 检查是否已 bind
      if (mapper.hasBind(shortId)) {
        return mapper.resolve(shortId)
      }

      // 未 bind：返回原始值（可能是错误情况）
      logger.warn(`[ToolExecutor] 占位符 ${shortId} 尚未绑定`)
      return value
    }

    if (Array.isArray(value)) {
      return value.map(resolveValue)
    }

    if (value && typeof value === 'object') {
      const result: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(value)) {
        result[k] = resolveValue(v)
      }
      return result
    }

    return value
  }

  return resolveValue(args) as Record<string, unknown>
}

/**
 * 工具执行器（单例）
 */
class ToolExecutor {
  private writeQueue: QueuedTool[] = []
  private isProcessingWrite = false
  private parallelCount = 0
  private lastMindMap: MindMap | null = null

  /**
   * 执行工具（自动管理队列）
   */
  async execute(
    toolName: string,
    args: Record<string, unknown>,
    mindMap: MindMap,
    idMapper: SessionIdMapper
  ): Promise<ExecutionResult> {
    if (READ_ONLY_TOOLS.has(toolName)) {
      this.parallelCount++
      try {
        return await executeToolCall(toolName, args, mindMap, idMapper)
      } finally {
        this.parallelCount--
      }
    }

    if (WRITE_TOOLS.has(toolName)) {
      return new Promise<ExecutionResult>((resolve, reject) => {
        this.writeQueue.push({ toolName, args, mindMap, idMapper, resolve, reject })
        this.processWriteQueue()
      })
    }

    logger.warn(`[ToolExecutor] 未知工具 ${toolName}，作为只读工具处理`)
    return executeToolCall(toolName, args, mindMap, idMapper)
  }

  /**
   * 处理写入队列（串行）+ 批量历史记录 + 延迟执行避免卡顿
   *
   * 性能优化：将连续的工具调用合并为一次历史记录（减少 simpleDeepClone 调用）
   *
   * 新策略：
   * 1. 开始执行第一个工具时，pause() 暂停历史记录
   * 2. 执行所有工具（500ms 延迟避免卡顿）
   * 3. 队列清空后，recovery() 恢复历史记录，并立即 addHistory()
   * 4. 不使用定时器，确保用户可以立即 undo
   *
   * 同轮引用支持：
   * - 每个工具执行前，先 resolve 占位符为真实 UUID
   * - 由于 write tools 串行执行，前置工具 bind 后，后续工具即可使用
   */
  private async processWriteQueue() {
    if (this.isProcessingWrite || this.writeQueue.length === 0) {
      return
    }

    this.isProcessingWrite = true
    let batchStarted = false

    while (this.writeQueue.length > 0) {
      const task = this.writeQueue.shift()!
      const { toolName, args, mindMap, idMapper, resolve, reject } = task

      try {
        // debug log 已删除

        // ✅ 第一个工具：开始批量操作
        if (!batchStarted) {
          mindMap.command.pause()
          batchStarted = true
          this.lastMindMap = mindMap
          logger.info('[ToolExecutor] 批量操作开始，已暂停历史记录')
        }

        try {
          // ✅ 同轮引用：执行前 resolve 占位符为真实 UUID
          const resolvedArgs = resolvePlaceholders(args, idMapper)
          const result = await executeToolCall(toolName, resolvedArgs, mindMap, idMapper)
          resolve(result)
        } catch (innerError) {
          logger.error(`[ToolExecutor] 工具 ${toolName} 执行异常`, { error: innerError })
          reject(innerError instanceof Error ? innerError : new Error(String(innerError)))
        }

        // ✅ 在下一个工具执行前延迟 500ms，避免卡顿
        if (this.writeQueue.length > 0) {
          await new Promise(resolve => setTimeout(resolve, 500))
        }
      } catch (error) {
        logger.error(`[ToolExecutor] 修改工具 ${toolName} 执行失败`, { error })
        reject(error instanceof Error ? error : new Error(String(error)))
      }
    }

    // ✅ 批量操作结束：恢复并立即添加一次历史记录
    if (batchStarted && this.lastMindMap) {
      this.lastMindMap.command.recovery()
      this.lastMindMap.command.addHistory()
      logger.info('[ToolExecutor] 批量操作完成，已添加历史记录')
    }

    this.isProcessingWrite = false
  }

  /**
   * 获取当前队列状态
   */
  getStatus() {
    return {
      writeQueueLength: this.writeQueue.length,
      isProcessingWrite: this.isProcessingWrite,
      parallelCount: this.parallelCount
    }
  }
}

// 导出单例
export const toolExecutor = new ToolExecutor()
