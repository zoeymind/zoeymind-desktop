/**
 * CircularProgress - 通用圆环进度条组件
 * 复用自 ContextUsageIndicator 的设计
 */

import React from 'react'
import { HoverCard, HoverCardContent, HoverCardTrigger } from './hover-card'
import { cn } from './cn'

interface CircularProgressProps {
  current?: number
  total?: number
  size?: number
  strokeWidth?: number
  showText?: boolean
  showPercentage?: boolean
  className?: string
  tooltip?: string
  color?: string
}

export const CircularProgress: React.FC<CircularProgressProps> = ({
  current,
  total,
  size = 14,
  strokeWidth = 2,
  showText = true,
  showPercentage = true,
  className,
  tooltip,
  color = 'var(--color-foreground)'
}) => {
  const safeTotal = total ?? 0
  const safeCurrent = current ?? 0
  const percentage = safeTotal > 0 ? (safeCurrent / safeTotal) * 100 : 0

  // 圆环 SVG 参数
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (Math.min(percentage, 100) / 100) * circumference

  const content = (
    <div className={cn('flex items-center gap-1.5', className)}>
      {showText && (
        <span className="text-xs text-foreground font-medium whitespace-nowrap">
          {showPercentage ? `${Math.round(percentage)}%` : `${safeCurrent}/${safeTotal}`}
        </span>
      )}
      {/* 圆环进度条 */}
      <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
        <svg className="transform -rotate-90" width={size} height={size}>
          {/* 背景圆环 */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="var(--color-border)"
            strokeWidth={strokeWidth}
          />
          {/* 进度圆环 */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            style={{
              transition: 'stroke-dashoffset 0.3s ease'
            }}
          />
        </svg>
      </div>
    </div>
  )

  if (tooltip) {
    return (
      <HoverCard>
        <HoverCardTrigger delay={200} render={<div className="cursor-pointer">{content}</div>} />
        <HoverCardContent className="w-auto p-2 text-xs" side="bottom" align="center">
          <div className="flex flex-col gap-0.5">
            <div className="font-medium text-foreground">{tooltip}</div>
          </div>
        </HoverCardContent>
      </HoverCard>
    )
  }

  return content
}
