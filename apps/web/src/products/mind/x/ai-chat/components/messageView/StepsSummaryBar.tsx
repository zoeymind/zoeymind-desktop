/**
 * StepsSummaryBar - 工具调用步骤折叠摘要栏
 *
 * 参考 opencode session-turn.tsx 的折叠触发器设计：
 * - 执行中：Spinner + 实时状态文字 + 实时计时
 * - 完成后：状态图标 + 步骤摘要 + 总耗时
 * - 可点击切换折叠/展开
 */

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/shared/app-shared'
import { getToolLabel } from '../../../ai-chat/tools/registry'
import { useTranslation } from '@zoeymind/i18n'
import type { ToolCallPart } from './ToolCallCard'

/**
 * 格式化秒数为用户友好的文字
 */
import { formatDuration } from '@/shared/app-shared'

interface StepsSummaryBarProps {
  toolParts: ToolCallPart[]
  isExpanded: boolean
  onToggle: () => void
  /** 当前消息是否正在处理中 */
  isProcessing: boolean
  /**
   * 第一个工具出现的时间戳（由父组件提供）
   * 为 null 表示历史消息，无法计算耗时
   */
  startTime: number | null
}

export const StepsSummaryBar: React.FC<StepsSummaryBarProps> = ({
  toolParts,
  isExpanded,
  onToggle,
  isProcessing,
  startTime
}) => {
  const { t } = useTranslation()

  // Inline switch avoids i18next strict-key union-type incompatibility
  const getToolStatusText = (toolName: string): string => {
    switch (toolName) {
      case 'list_modules':
        return t('mindmap.aiChat.message.toolStatus.listModules')
      case 'search_cases':
        return t('mindmap.aiChat.message.toolStatus.searchCases')
      case 'get_module_cases':
        return t('mindmap.aiChat.message.toolStatus.getModuleCases')
      case 'add_cases':
        return t('mindmap.aiChat.message.toolStatus.addCases')
      case 'add_module':
        return t('mindmap.aiChat.message.toolStatus.addModule')
      case 'update_cases':
        return t('mindmap.aiChat.message.toolStatus.updateCases')
      case 'update_module':
        return t('mindmap.aiChat.message.toolStatus.updateModule')
      case 'delete_cases':
        return t('mindmap.aiChat.message.toolStatus.deleteCases')
      case 'delete_module':
        return t('mindmap.aiChat.message.toolStatus.deleteModule')
      case 'web_search':
        return t('mindmap.aiChat.message.toolStatus.webSearch')
      case 'web_fetch':
        return t('mindmap.aiChat.message.toolStatus.webFetch')
      case 'get_figma_metadata':
        return t('mindmap.aiChat.message.toolStatus.getFigmaMetadata')
      case 'get_figma_data':
        return t('mindmap.aiChat.message.toolStatus.getFigmaData')
      case 'get_figma_image':
        return t('mindmap.aiChat.message.toolStatus.getFigmaImage')
      case 'read_feishu_document':
        return t('mindmap.aiChat.message.toolStatus.readFeishuDocument')
      case 'search_feishu_documents':
        return t('mindmap.aiChat.message.toolStatus.searchFeishuDocuments')
      case 'query_knowledge_bases':
        return t('mindmap.aiChat.message.toolStatus.queryKnowledgeBases')
      case 'question':
        return t('mindmap.aiChat.message.toolStatus.question')
      default:
        return t('mindmap.aiChat.message.toolStatus.defaultPending', {
          name: getToolLabel(toolName) || toolName
        })
    }
  }
  // ---- 实时计时器（参考 opencode 的 duration 逻辑） ----
  const [now, setNow] = useState(Date.now())

  // 判断是否有正在执行的工具（排除 question 等待用户反馈的场景）
  const hasActiveTool = toolParts.some(p => {
    const isActive = p.state === 'input-streaming' || p.state === 'input-available'
    if (!isActive) return false
    const name = p.type.replace('tool-', '')
    return name !== 'question'
  })
  const isWorking = isProcessing || hasActiveTool

  // 工作中每秒刷新 now；完成后停止
  useEffect(() => {
    if (!isWorking) return

    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [isWorking])

  // 完成的那一刻冻结 finalTime
  const finalTimeRef = useRef<number | null>(null)
  useEffect(() => {
    if (isWorking) {
      finalTimeRef.current = null
    } else if (finalTimeRef.current === null) {
      finalTimeRef.current = Date.now()
    }
  }, [isWorking])

  // 计算耗时：有 startTime 才能算
  const displayElapsed =
    startTime !== null ? Math.floor(((finalTimeRef.current ?? now) - startTime) / 1000) : null

  // ---- 状态文字（参考 opencode：working 显示实时状态，完成后显示"显示/隐藏步骤"） ----

  // 计算实时状态（仅 working 时有效）
  const rawWorkingStatus = useMemo(() => {
    // 从末尾找最后一个正在执行的工具
    for (let i = toolParts.length - 1; i >= 0; i--) {
      const part = toolParts[i]
      const isPending = part.state === 'input-streaming' || part.state === 'input-available'
      if (isPending) {
        const toolName = part.type.replace('tool-', '')
        return getToolStatusText(toolName)
      }
    }
    return t('mindmap.aiChat.message.thinking')
  }, [toolParts, t])

  // 防抖 working 状态文字（1.5s，避免工具快速切换时闪烁）
  const [debouncedWorkingStatus, setDebouncedWorkingStatus] = useState(rawWorkingStatus)
  const lastStatusChangeRef = useRef(Date.now())
  const statusTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const updateDebouncedStatus = useCallback((newStatus: string) => {
    const timeSinceLastChange = Date.now() - lastStatusChangeRef.current
    if (timeSinceLastChange >= 1500) {
      setDebouncedWorkingStatus(newStatus)
      lastStatusChangeRef.current = Date.now()
      if (statusTimeoutRef.current) {
        clearTimeout(statusTimeoutRef.current)
        statusTimeoutRef.current = null
      }
    } else {
      if (statusTimeoutRef.current) clearTimeout(statusTimeoutRef.current)
      statusTimeoutRef.current = setTimeout(() => {
        setDebouncedWorkingStatus(newStatus)
        lastStatusChangeRef.current = Date.now()
        statusTimeoutRef.current = null
      }, 1500 - timeSinceLastChange)
    }
  }, [])

  useEffect(() => {
    if (isWorking) {
      updateDebouncedStatus(rawWorkingStatus)
    }
  }, [rawWorkingStatus, isWorking, updateDebouncedStatus])

  // 清理定时器
  useEffect(() => {
    return () => {
      if (statusTimeoutRef.current) {
        clearTimeout(statusTimeoutRef.current)
      }
    }
  }, [])

  // 完成/总数
  const completedCount = toolParts.filter(
    p => p.state === 'output-available' || p.state === 'output-error'
  ).length
  const totalCount = toolParts.length

  // 最终显示的文字
  const displayText = isWorking
    ? debouncedWorkingStatus
    : isExpanded
      ? t('mindmap.aiChat.message.hideSteps')
      : t('mindmap.aiChat.message.stepCount', { value: completedCount })

  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        'flex w-full items-center gap-1.5 px-2 py-1.5 text-xs transition-colors rounded-xl',
        'hover:bg-muted/60 cursor-pointer select-none',
        isWorking ? 'text-foreground' : 'text-muted-foreground'
      )}
    >
      <ChevronDown
        className={cn(
          'size-3 text-muted-foreground/50 transition-transform flex-shrink-0',
          isExpanded ? 'rotate-180' : ''
        )}
      />

      <span className="text-left truncate">{displayText}</span>

      {/* 进度：working 时显示 完成/总数 */}
      {isWorking && totalCount > 0 && (
        <span className="text-[10px] text-muted-foreground/50 tabular-nums flex-shrink-0">
          {completedCount}/{totalCount}
        </span>
      )}

      <div className="flex-1" />

      {displayElapsed !== null && displayElapsed > 0 && (
        <span className="text-[10px] text-muted-foreground/50 tabular-nums flex-shrink-0">
          {formatDuration(displayElapsed)}
        </span>
      )}
    </button>
  )
}
