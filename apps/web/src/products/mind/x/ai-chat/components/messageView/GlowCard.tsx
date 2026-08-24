/**
 * 多步骤工具卡片的执行态边框。
 * 仅在工具仍在运行时播放流光；完成后保留普通主题边框。
 */

import React from "react"
import { BorderBeam } from "border-beam"
import { useTheme } from "@zoeymind/ui"

interface GlowCardProps {
  children: React.ReactNode
  active?: boolean
}

export const GlowCard: React.FC<GlowCardProps> = ({ children, active = true }) => {
  const { resolvedTheme } = useTheme()

  return (
    <BorderBeam
      active={active}
      borderRadius={12}
      colorVariant="ocean"
      duration={2.4}
      size="md"
      strength={0.72}
      theme={resolvedTheme}
      className="w-full"
    >
      <div className="w-full rounded-xl border border-border">{children}</div>
    </BorderBeam>
  )
}
