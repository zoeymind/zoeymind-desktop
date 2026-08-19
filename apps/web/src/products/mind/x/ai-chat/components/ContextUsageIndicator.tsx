// @ts-nocheck — desktop mirror of cloud AI chat; runtime bridged via bridge.tsx
/**
 * ContextUsageIndicator - Context Token 使用率圆环进度条
 */

import React from 'react'
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@zoeymind/ui'
import { useTranslation } from '@zoeymind/i18n'
import { Loader2 } from 'lucide-react'
import { useCompactionStore } from '../../ai-chat/compaction/useCompactionStore'
import { cn } from '@/shared/app-shared'

interface ContextUsageIndicatorProps {
  usedTokens: number
  maxTokens: number
}

export const ContextUsageIndicator: React.FC<ContextUsageIndicatorProps> = ({
  usedTokens,
  maxTokens
}) => {
  const { t } = useTranslation()
  const compactionPhase = useCompactionStore(s => s.phase)
  const lastResult = useCompactionStore(s => s.lastResult)
  const percentage = maxTokens > 0 ? (usedTokens / maxTokens) * 100 : 0
  const displayPercentage = Math.min(percentage, 100).toFixed(1)

  // 阈值色: 接近 / 超过 70% 时圈变 amber 提示, 95% 以上变 red.
  // 压缩中 spinner 替换圈本身.
  const isWarning = percentage >= 70 && percentage < 95
  const isCritical = percentage >= 95
  const ringClass = isCritical
    ? 'stroke-destructive'
    : isWarning
      ? 'stroke-amber-500'
      : 'stroke-foreground'

  // 圆环 SVG 参数
  const size = 14
  const strokeWidth = 2
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (Math.min(percentage, 100) / 100) * circumference

  // 格式化数字（K 或 M）
  const formatNumber = (num: number): string => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
    return num.toString()
  }

  return (
    <HoverCard>
      <HoverCardTrigger
        delay={200}
        render={
          <div className="flex items-center gap-1.5 cursor-pointer">
            {/* 百分比文字（左侧） */}
            <span
              className={cn(
                'text-xs font-medium',
                isCritical
                  ? 'text-destructive'
                  : isWarning
                    ? 'text-warning dark:text-warning'
                    : 'text-foreground'
              )}
            >
              {Math.round(percentage)}%
            </span>
            {/* 圆环进度条 / 压缩中 spinner */}
            {compactionPhase === 'pending' ? (
              <Loader2 className="size-3.5 animate-spin text-warning" />
            ) : (
              <div className="relative" style={{ width: size, height: size }}>
                <svg className="transform -rotate-90" width={size} height={size}>
                  <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    className="stroke-muted"
                    strokeWidth={strokeWidth}
                  />
                  <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    className={ringClass}
                    strokeWidth={strokeWidth}
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    strokeLinecap="round"
                    style={{ transition: 'stroke-dashoffset 0.3s ease' }}
                  />
                </svg>
              </div>
            )}
          </div>
        }
      />
      <HoverCardContent className="w-auto p-2 text-xs" side="bottom" align="center">
        <div className="flex flex-col gap-1">
          <div className="font-medium text-foreground">
            {t('mindmap.aiChat.core.contextUsed', {
              value: `${displayPercentage}% · ${formatNumber(usedTokens)}/${formatNumber(maxTokens)}`
            })}
          </div>

          {/* 压缩状态: 进行中 / 刚完成 提示 */}
          {compactionPhase === 'pending' && (
            <div className="text-warning dark:text-warning">
              {t('mindmap.aiChat.compaction.pendingHint')}
            </div>
          )}
          {compactionPhase === 'done' && lastResult && (
            <div className="text-success dark:text-success">
              {t('mindmap.aiChat.compaction.doneHint', {
                count: lastResult.compactedCount
              })}
            </div>
          )}
          {compactionPhase !== 'pending' && isWarning && (
            <div className="text-warning dark:text-warning text-[10px]">
              {t('mindmap.aiChat.compaction.willTriggerHint')}
            </div>
          )}
        </div>
      </HoverCardContent>
    </HoverCard>
  )
}
