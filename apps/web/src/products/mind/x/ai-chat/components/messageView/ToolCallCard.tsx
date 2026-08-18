// @ts-nocheck — dormant AI chat / MCP module (bridge.tsx flattens to no-op)
/**
 * ToolCallCard - 工具调用卡片（通用渲染）
 *
 * 每个工具可以自定义输入和输出的渲染逻辑
 * 如果没有自定义渲染器，则通用地显示 input 和 output
 */

import React, { useState, useEffect, useRef, useMemo } from 'react'
import {
  ChevronDown,
  Loader2,
  ListTree,
  Search,
  FolderOpen,
  Plus,
  Trash2,
  PenLine,
  MessageSquare,
  Globe,
  Code,
  Figma,
  Image
} from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { cn } from '@/shared/app-shared'
import { ToolErrorBoundary } from '../../../ai-chat/components/ErrorBoundary'
import { getToolLabel } from '../../../ai-chat/tools/registry'
import { useTranslation } from '@zoeymind/i18n'

// 导入工具 UI 渲染器
import { renderGetModuleCasesOutput } from '../../../ai-chat/tools/ui/GetModuleCasesUI'
import { renderListModulesOutput } from '../../../ai-chat/tools/ui/ListModulesUI'
import { renderSearchCasesOutput } from '../../../ai-chat/tools/ui/SearchCasesUI'
import {
  renderAddCasesInput,
  renderAddCasesOutput
} from '../../../ai-chat/tools/ui/AddCasesUI'
import { renderDeleteCasesInput } from '../../../ai-chat/tools/ui/DeleteCasesUI'
import { renderUpdateCasesOutput } from '../../../ai-chat/tools/ui/UpdateCasesUI'
import { renderAddModuleInput } from '../../../ai-chat/tools/ui/AddModuleUI'
import { renderDeleteModuleInput } from '../../../ai-chat/tools/ui/DeleteModuleUI'
import { renderUpdateModuleOutput } from '../../../ai-chat/tools/ui/UpdateModuleUI'
import {
  getCachedToolResult,
  type ToolArgs,
  type ExecutionResult
} from '../../../ai-chat/tools/types'
import type {
  AddCasesInput,
  AddModuleInput,
  DeleteCasesInput,
  DeleteModuleInput
} from '../../../ai-chat/types'
import { countTokensInValue } from '../../../ai-chat/utils/tokenCounter'

/**
 * 工具自定义渲染器接口
 * 每个工具决定展开后显示什么内容
 */
type ToolCustomRenderer = (input: ToolArgs, output: ExecutionResult) => React.ReactNode

/**
 * UI 渲染器注册表
 * 每个工具可以注册自己的渲染逻辑和交互。
 *
 * 注：`input` 在这一层是 `ToolArgs`（Record<string, unknown>）—— AI SDK 工具调用是
 * 动态分派，args 形状由对应 Zod schema 在服务端保证。这里按 toolName 路由到具体
 * renderer 时，做一次窄化断言；renderer 内部就是强类型的，不再有 `as` 噪音。
 *
 * 返回 null 表示不显示任何内容
 */

const toolCustomRenderers: Record<string, ToolCustomRenderer> = {
  // 查询类：展示可点击列表

  list_modules: (_input, output) => renderListModulesOutput(output),

  search_cases: (_input, output) => renderSearchCasesOutput(output),

  get_module_cases: (_input, output) => renderGetModuleCasesOutput(output),

  // Add 类：展示 artifacts 风格内容（输入+输出）
  add_cases: (input, output) => (
    <div className="space-y-2">
      {renderAddCasesInput(input as unknown as AddCasesInput)}
      {output.success && renderAddCasesOutput(output)}
    </div>
  ),

  add_module: (input, _output) => renderAddModuleInput(input as unknown as AddModuleInput),

  // Delete 类：展示 ID 列表

  delete_cases: (input, _output) => renderDeleteCasesInput(input as unknown as DeleteCasesInput),

  delete_module: (input, _output) => renderDeleteModuleInput(input as unknown as DeleteModuleInput),

  // Update 类：展示可点击列表

  update_cases: (_input, output) => renderUpdateCasesOutput(output),

  update_module: (_input, output) => renderUpdateModuleOutput(output)
}

/**
 * 工具图标映射
 * 不同工具对应不同的图标，体现工具功能
 */
const toolIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  list_modules: ListTree, // 列表模块：树状图标
  search_cases: Search, // 搜索用例：搜索图标
  get_module_cases: FolderOpen, // 获取模块用例：打开文件夹图标
  add_cases: Plus, // 添加用例：加号图标
  add_module: Plus, // 添加模块：加号图标
  delete_cases: Trash2, // 删除用例：删除图标
  delete_module: Trash2, // 删除模块：删除图标
  update_cases: PenLine, // 更新用例：编辑图标
  update_module: PenLine, // 更新模块：编辑图标
  question: MessageSquare, // 询问用户：消息图标
  web_search: Search, // 网络搜索：搜索图标
  web_fetch: Globe, // 获取网页：地球图标
  read_feishu_document: MessageSquare, // 飞书文档：消息图标
  search_feishu_documents: Search, // 搜索飞书文档：搜索图标
  query_knowledge_bases: Code, // 知识库查询：代码图标
  get_figma_metadata: Figma, // Figma 骨架：Figma 图标
  get_figma_data: Figma, // 获取 Figma 设计：Figma 图标
  get_figma_image: Image // Figma 截图：图片图标
}

/**
 * 注册工具自定义渲染器
 * 供外部使用，方便扩展新工具
 */
export function registerToolUI(toolName: string, renderer: ToolCustomRenderer) {
  toolCustomRenderers[toolName] = renderer
}

/**
 * 注册工具图标
 */
export function registerToolIcon(
  toolName: string,
  icon: React.ComponentType<{ className?: string }>
) {
  toolIcons[toolName] = icon
}

export interface ToolCallPart {
  type: string
  toolCallId?: string
  input?: ToolArgs
  output?: ExecutionResult
  state?: 'input-streaming' | 'input-available' | 'output-available' | 'output-error'
  errorText?: string
}

interface ToolCallCardProps {
  part: ToolCallPart
}

export const ToolCallCard: React.FC<ToolCallCardProps> = ({ part }) => {
  const { t } = useTranslation()
  const [isExpanded, setIsExpanded] = useState(false)

  const toolName = part.type.replace('tool-', '')
  const customRenderer = toolCustomRenderers[toolName]

  // UI 渲染用完整结果（含 data），优先从缓存取（model output 已精简）
  const fullOutput = useMemo(
    () => (part.toolCallId ? getCachedToolResult(part.toolCallId) : undefined) || part.output,
    [part.toolCallId, part.output]
  )

  const isAskUser = toolName === 'question'
  const isPending = part.state === 'input-streaming' || part.state === 'input-available'
  const isWaitingUser = isAskUser && isPending
  const isFailed = part.state === 'output-error'
  const isInterrupted =
    isFailed && part.errorText === t('mindmap.aiChat.message.executionInterrupted')
  const isComplete = part.state === 'output-available'

  // ---- 单步耗时计算 ----
  const startTimeRef = useRef<number>(Date.now())
  const [elapsed, setElapsed] = useState(0)
  const [finalDuration, setFinalDuration] = useState<number | null>(null)

  // 计时器：pending 期间每秒更新（question 等待用户时停止计时）
  useEffect(() => {
    if (!isPending || isWaitingUser) {
      if (finalDuration === null) {
        setFinalDuration(Math.max(0, (Date.now() - startTimeRef.current) / 1000))
      }
      return
    }

    const timer = setInterval(() => {
      setElapsed((Date.now() - startTimeRef.current) / 1000)
    }, 1000)

    return () => clearInterval(timer)
  }, [isPending, isWaitingUser, finalDuration])

  // 格式化耗时
  const durationDisplay = (() => {
    const secs = finalDuration ?? elapsed
    if (secs < 0.5) return null // 太短不显示
    if (secs < 1) return '< 1s'
    if (secs < 60) return `${secs.toFixed(1)}s`
    return `${Math.floor(secs / 60)}m${Math.floor(secs % 60)}s`
  })()

  // 判断执行结果（成功/失败）— 用精简的 part.output 判断状态即可
  const isSuccess = isComplete && part.output?.success === true
  const isOutputFailed = isComplete && part.output?.success === false
  const displayName = getToolLabel(toolName) || toolName

  const statusColor = isWaitingUser
    ? 'bg-warning'
    : isPending
      ? 'bg-primary/60'
      : isSuccess
        ? 'bg-primary'
        : isInterrupted
          ? 'bg-muted-foreground/40'
          : isOutputFailed || part.state === 'output-error'
            ? 'bg-destructive'
            : 'bg-muted-foreground/30'

  const Icon = toolIcons[toolName]

  // Token 计数 (UI 显示用), 走 js-tiktoken o200k_base. input-streaming 阶段 SDK 只给 {}, 跳过.
  // 真实 token 走 streamText.finish.totalUsage, 那个在 metadata 里精确.
  const tokenCount = useMemo(() => {
    let n = 0
    if (part.input && typeof part.input === 'object' && Object.keys(part.input).length > 0) {
      n += countTokensInValue(part.input)
    }
    if (part.output) n += countTokensInValue(part.output)
    return n
  }, [part.input, part.output])

  const hasExpandableContent = !isPending && (isFailed || isComplete)

  return (
    <div className="w-full max-w-full">
      {/* 头部行：状态点 + 工具名 + 耗时（参考 opencode 的单行 tool step 风格） */}
      <div
        className={cn(
          'flex items-center gap-1.5 py-0.5 rounded-sm transition-colors',
          hasExpandableContent && 'cursor-pointer hover:bg-muted/40',
          isExpanded && 'bg-muted/30'
        )}
        onClick={() => hasExpandableContent && setIsExpanded(!isExpanded)}
      >
        {/* 状态指示 */}
        {isPending && !isWaitingUser ? (
          <Loader2 className="size-3 animate-spin text-primary flex-shrink-0" />
        ) : isWaitingUser ? (
          <MessageSquare className="size-3 text-warning flex-shrink-0" />
        ) : (
          <div className={cn('size-1.5 rounded-full flex-shrink-0', statusColor)} />
        )}

        {/* 工具图标 */}
        {!isPending && !isWaitingUser && Icon && (
          <Icon className="size-3 text-muted-foreground flex-shrink-0" />
        )}

        {/* 工具名 */}
        <span
          className={cn(
            'text-xs truncate',
            isWaitingUser
              ? 'text-warning dark:text-warning font-medium'
              : isPending
                ? 'text-foreground font-medium'
                : 'text-muted-foreground'
          )}
        >
          {displayName}
        </span>

        {/* 状态文字 */}
        {isWaitingUser && (
          <span className="text-[10px] text-warning">
            {t('mindmap.aiChat.message.waitingFeedback')}
          </span>
        )}
        {isPending && !isWaitingUser && (
          <span className="text-[10px] text-primary/70">
            {t('mindmap.aiChat.message.executing')}
          </span>
        )}
        {isInterrupted && (
          <span className="text-[10px] text-muted-foreground/50">
            {t('mindmap.aiChat.message.aborted')}
          </span>
        )}

        {/* 实时 token 计数 */}
        {tokenCount > 0 && (
          <span
            className={cn(
              'text-[10px] tabular-nums flex-shrink-0',
              isPending ? 'text-primary/60' : 'text-muted-foreground/40'
            )}
          >
            ~{tokenCount.toLocaleString()} tokens
          </span>
        )}

        <div className="flex-1" />

        {/* 耗时 */}
        {durationDisplay && !isPending && (
          <span className="text-[10px] text-muted-foreground/50 tabular-nums flex-shrink-0">
            {durationDisplay}
          </span>
        )}

        {/* 展开箭头 */}
        {hasExpandableContent && (
          <ChevronDown
            className={cn(
              'size-3 text-muted-foreground/40 transition-transform flex-shrink-0',
              isExpanded && 'rotate-180'
            )}
          />
        )}
      </div>

      {/* 展开内容 */}
      <AnimatePresence>
        {isExpanded && !isPending && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <div className="ml-3 pl-2 border-l border-muted mt-0.5 max-h-[500px] overflow-y-auto space-y-2">
              {isFailed && part.errorText && (
                <div className="rounded-sm bg-destructive/10 p-2">
                  <div className="mb-1 text-[10px] font-medium text-destructive">
                    {t('mindmap.aiChat.message.errorLabel')}
                  </div>
                  <div className="whitespace-pre-wrap text-xs text-destructive">
                    {part.errorText}
                  </div>
                </div>
              )}

              {isComplete &&
                fullOutput &&
                (() => {
                  if (customRenderer) {
                    return (
                      <ToolErrorBoundary toolName={toolName}>
                        {customRenderer(part.input || {}, fullOutput)}
                      </ToolErrorBoundary>
                    )
                  }

                  return (
                    <div className="space-y-2">
                      {part.input && (
                        <div className="rounded-sm bg-muted p-2">
                          <div className="mb-1 text-[10px] font-medium text-muted-foreground">
                            {t('mindmap.aiChat.message.inputLabel')}
                          </div>
                          <div className="text-xs text-foreground break-all">
                            {typeof part.input === 'string' ? (
                              <div className="whitespace-pre-wrap">{part.input}</div>
                            ) : (
                              <div className="whitespace-pre-wrap font-mono text-xs">
                                {JSON.stringify(part.input, null, 2)}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                      {fullOutput && (
                        <div className="rounded-sm bg-muted p-2">
                          <div className="mb-1 text-[10px] font-medium text-muted-foreground">
                            {t('mindmap.aiChat.message.outputLabel')}
                          </div>
                          {fullOutput.success === false ? (
                            <div className="text-xs text-destructive break-all">
                              {fullOutput.error || t('mindmap.aiChat.message.executionFailed')}
                            </div>
                          ) : fullOutput.data && typeof fullOutput.data === 'object' ? (
                            <div className="text-xs text-foreground break-all">
                              {(() => {
                                const data = fullOutput.data as Record<string, unknown>
                                if (typeof data.content === 'string') {
                                  return <div className="whitespace-pre-wrap">{data.content}</div>
                                }
                                if (typeof data.results === 'string') {
                                  return <div className="whitespace-pre-wrap">{data.results}</div>
                                }
                                return (
                                  <div className="whitespace-pre-wrap font-mono text-xs">
                                    {JSON.stringify(fullOutput.data, null, 2)}
                                  </div>
                                )
                              })()}
                            </div>
                          ) : (
                            <div className="text-xs text-foreground whitespace-pre-wrap font-mono break-all">
                              {JSON.stringify(fullOutput, null, 2)}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })()}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}