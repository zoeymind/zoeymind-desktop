/**
 * PasteZone — 让一个 UI 区域"接管"当前的 Ctrl+V 粘贴。
 *
 * 场景：一个页面同时存在多个"可粘贴文件"的区域（缺陷附件、评论输入区、评论编辑
 * 附件网格）。全局 window paste 监听会互相踩踏。此组件把"哪个区域接收粘贴"
 * 显式化成 focus 状态：点击 chip 激活；点外面 blur 自动关；同一时刻只有一个实例
 * 在监听。
 *
 * 排他策略：模块级 activeInstance 记录当前激活实例；新实例激活时把旧的自动 blur。
 * 该策略不依赖 store —— 因为 focus 本来就是浏览器排他的，我们只是复用它。
 */

import { useEffect, useRef, useState } from 'react'
import { ClipboardPaste } from 'lucide-react'
import { cn } from './cn'

/** 模块级：当前激活的 PasteZone 关闭器。新实例激活时先关旧的。 */
let releaseCurrent: (() => void) | null = null

export interface PasteZoneProps {
  /** 用户粘贴（文件/图片）时的回调；空数组时不触发。 */
  onFiles: (files: File[]) => void
  /** 未激活时的文案（默认 "启用粘贴"）。传空字符串则只显示图标。 */
  idleLabel?: string
  /** 已激活时的文案（默认 "粘贴到此"）。 */
  activeLabel?: string
  /** 激活态变更回调（可选，caller 用来联动别的 UI）。 */
  onActiveChange?: (active: boolean) => void
  /**
   * 视觉变体：
   *   - `chip`（默认）：胶囊按钮，激活态 bg-primary/10 高亮
   *   - `subtle`：无边框，仅文字变色（嵌到 dropzone 里用，与 upload 按钮同一视觉层级）
   */
  variant?: 'chip' | 'subtle'
  /** 额外 className。 */
  className?: string
  /** 禁用 — 关闭激活能力，但仍显示 idle 样式（可用于 disabled tooltip 场景）。 */
  disabled?: boolean
}

export function PasteZone({
  onFiles,
  idleLabel,
  activeLabel,
  onActiveChange,
  variant = 'chip',
  className,
  disabled
}: PasteZoneProps) {
  const [active, setActive] = useState(false)
  const btnRef = useRef<HTMLButtonElement>(null)
  const onFilesRef = useRef(onFiles)
  onFilesRef.current = onFiles

  useEffect(() => {
    onActiveChange?.(active)
  }, [active, onActiveChange])

  useEffect(() => {
    if (!active) return
    const handle = (e: ClipboardEvent) => {
      const cd = e.clipboardData
      if (!cd) return
      const files: File[] = []
      if (cd.files && cd.files.length) {
        for (const f of cd.files) files.push(f)
      }
      if (files.length === 0 && cd.items) {
        for (const it of cd.items) {
          if (it.kind === 'file') {
            const f = it.getAsFile()
            if (f) files.push(f)
          }
        }
      }
      if (files.length > 0) {
        e.preventDefault()
        onFilesRef.current(files)
      }
    }
    window.addEventListener('paste', handle)
    return () => window.removeEventListener('paste', handle)
  }, [active])

  const activate = () => {
    if (disabled || active) return
    releaseCurrent?.()
    setActive(true)
    releaseCurrent = () => setActive(false)
  }

  // blur 覆盖"点外面"场景。延迟一拍让同区域鼠标交互不误关。
  const handleBlur = () => {
    window.setTimeout(() => {
      if (document.activeElement !== btnRef.current) setActive(false)
    }, 0)
  }

  const label = active ? activeLabel : idleLabel
  const chipStyle =
    variant === 'chip'
      ? cn(
          'inline-flex h-7 items-center gap-1 rounded px-2 text-xs transition-colors',
          active
            ? 'bg-primary/10 text-primary ring-1 ring-primary/30'
            : 'text-muted-foreground hover:bg-muted hover:text-foreground'
        )
      : cn(
          'inline-flex items-center gap-1 text-xs transition-colors',
          active ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
        )

  return (
    <button
      ref={btnRef}
      type="button"
      onClick={activate}
      onBlur={handleBlur}
      disabled={disabled}
      className={cn(chipStyle, disabled && 'opacity-50', className)}
      aria-pressed={active}
    >
      <ClipboardPaste className="size-3.5" />
      {label !== '' && label}
    </button>
  )
}
