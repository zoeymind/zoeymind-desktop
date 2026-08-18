// @ts-nocheck — dormant AI chat / MCP module (bridge.tsx flattens to no-op)
/**
 * GlowCard - 光效卡片组件
 *
 * active 时边框做呼吸脉冲动画（border 透明度渐变），
 * 简洁地表示 AI 运行中状态。
 */

import React from 'react'

interface GlowCardProps {
  children: React.ReactNode
  active?: boolean
}

export const GlowCard: React.FC<GlowCardProps> = ({ children, active = true }) => (
  <div className={`rounded-xl border transition-colors ${active ? 'glow-pulse' : 'border-border'}`}>
    {children}
  </div>
)