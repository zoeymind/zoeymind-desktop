/**
 * ContextUsageIndicator - Context Token 使用率圆环进度条
 */

import React from "react"
import { Button, HoverCard, HoverCardContent, HoverCardTrigger } from "@zoeymind/ui"
import { useTranslation } from "@zoeymind/i18n"
import { Loader2 } from "lucide-react"
import { useCompactionStore } from "../../ai-chat/compaction/useCompactionStore"
import { useCompactionThresholdPercent } from "../../ai-chat/compaction/settings"

interface ContextUsageIndicatorProps {
  usedTokens: number
  maxTokens: number
}

export const ContextUsageIndicator: React.FC<ContextUsageIndicatorProps> = ({
  usedTokens,
  maxTokens,
}) => {
  const safeUsedTokens = Number.isFinite(usedTokens) ? Math.max(0, usedTokens) : 0
  const safeMaxTokens = Number.isFinite(maxTokens) && maxTokens > 0 ? maxTokens : 0
  const { t } = useTranslation()
  const compactionPhase = useCompactionStore(s => s.phase)
  const compaction = useCompactionStore(s => s.compaction)
  const compactionThreshold = useCompactionThresholdPercent()
  const percentage = safeMaxTokens > 0 ? (safeUsedTokens / safeMaxTokens) * 100 : 0
  const displayPercentage = Math.min(percentage, 100).toFixed(1)

  // 圆环与压缩器读取同一阈值。达到阈值前 10 个百分点预警，达到时标红。
  const isWarning = percentage >= compactionThreshold - 10 && percentage < compactionThreshold
  const isCritical = percentage >= compactionThreshold
  const ringClass = isCritical
    ? "stroke-destructive"
    : isWarning
      ? "stroke-amber-500"
      : "stroke-foreground"

  // 27px 按钮配 15px 圆环，四边各 6px，避免 WKWebView 半像素栅格偏移。
  const size = 15
  const strokeWidth = 2
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (Math.min(percentage, 100) / 100) * circumference
  const thresholdAngle = (compactionThreshold / 100) * Math.PI * 2 - Math.PI / 2
  const markerInnerRadius = radius - 1.75
  const markerOuterRadius = radius + 1.25
  const markerStart = {
    x: size / 2 + Math.cos(thresholdAngle) * markerInnerRadius,
    y: size / 2 + Math.sin(thresholdAngle) * markerInnerRadius,
  }
  const markerEnd = {
    x: size / 2 + Math.cos(thresholdAngle) * markerOuterRadius,
    y: size / 2 + Math.sin(thresholdAngle) * markerOuterRadius,
  }

  // 格式化数字（K 或 M）
  const formatNumber = (num: number): string => {
    if (!Number.isFinite(num)) return "0"
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
    return String(num)
  }

  return (
    <HoverCard>
      <HoverCardTrigger
        delay={200}
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="size-[27px] rounded-full"
            aria-label={t("mindmap.aiChat.core.contextUsed", {
              value: `${displayPercentage}% · ${formatNumber(safeUsedTokens)}/${formatNumber(safeMaxTokens)}`,
            })}
          >
            {compactionPhase === "pending" ? (
              <Loader2 className="relative -top-px size-[15px] animate-spin text-warning" />
            ) : (
              <svg
                className="relative -top-px block size-[15px]"
                width={size}
                height={size}
                viewBox={`0 0 ${size} ${size}`}
                aria-hidden="true"
              >
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
                  style={{ transition: "stroke-dashoffset 0.3s ease" }}
                />
                <line
                  x1={markerStart.x}
                  y1={markerStart.y}
                  x2={markerEnd.x}
                  y2={markerEnd.y}
                  className="stroke-foreground"
                  strokeWidth={1.25}
                  strokeLinecap="round"
                />
              </svg>
            )}
          </Button>
        }
      />
      <HoverCardContent className="w-auto p-2 text-xs" side="bottom" align="center">
        <div className="flex flex-col gap-1">
          <div className="font-medium text-foreground">
            {t("mindmap.aiChat.core.contextUsed", {
              value: `${displayPercentage}% · ${formatNumber(safeUsedTokens)}/${formatNumber(safeMaxTokens)}`,
            })}
          </div>
          <div className="text-muted-foreground">
            {t("mindmap.aiChat.compaction.thresholdDisplay", { value: compactionThreshold })}
          </div>

          {/* 压缩状态: 进行中 / 刚完成 提示 */}
          {compactionPhase === "pending" && (
            <div className="text-warning dark:text-warning">
              {t("mindmap.aiChat.compaction.pendingHint")}
            </div>
          )}
          {compactionPhase === "done" && compaction && (
            <div className="text-success dark:text-success">
              {t("mindmap.aiChat.compaction.doneHint", {
                count: compaction.compactedCount,
              })}
            </div>
          )}
          {compactionPhase !== "pending" && isWarning && (
            <div className="text-warning dark:text-warning text-[10px]">
              {t("mindmap.aiChat.compaction.willTriggerHint", { value: compactionThreshold })}
            </div>
          )}
        </div>
      </HoverCardContent>
    </HoverCard>
  )
}
