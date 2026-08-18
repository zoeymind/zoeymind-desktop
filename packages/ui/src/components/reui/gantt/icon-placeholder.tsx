/**
 * `IconPlaceholder` — reui/gantt 里的多图标库适配桥. 仓库红线 #3 只用 lucide-react,
 * 所以这里做个 shim: 读 `lucide` prop, 从 `lucide-react` 动态挑图标返回;
 * 其余库前缀 (tabler/hugeicons/phosphor/remixicon) 全部无视.
 *
 * 用法保持与 reui 源码兼容, gantt 代码文件不需要改.
 */

import * as React from 'react'
import * as LucideIcons from 'lucide-react'

type IconPlaceholderProps = {
  lucide?: string
  tabler?: string
  hugeicons?: string
  phosphor?: string
  remixicon?: string
  className?: string
  size?: number | string
  strokeWidth?: number
  'aria-hidden'?: boolean | 'true' | 'false'
  'aria-label'?: string
}

export function IconPlaceholder({
  lucide,
  tabler: _tabler,
  hugeicons: _hugeicons,
  phosphor: _phosphor,
  remixicon: _remixicon,
  ...rest
}: IconPlaceholderProps) {
  const name = lucide ?? 'CircleIcon'
  const Icon = (
    LucideIcons as unknown as Record<string, React.ComponentType<React.SVGProps<SVGSVGElement>>>
  )[name]
  if (!Icon) return null
  return <Icon {...(rest as React.SVGProps<SVGSVGElement>)} />
}
