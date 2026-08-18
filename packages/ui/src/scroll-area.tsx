'use client'

import * as React from 'react'
import { ScrollArea as ScrollAreaPrimitive } from '@base-ui/react/scroll-area'

import { cn } from '#lib/utils'

/**
 * 滚动容器 —— 基于 base-ui ScrollArea.
 *
 * 使用要点（踩坑清单，务必读）：
 *
 * 1. **必须有明确高宽**。ScrollArea 内部 Viewport 是 size-full，靠父容器给尺寸。
 *    - 传 `size={{ width, height }}` 明确 px（用 ResizeObserver 测父的场景）
 *    - 或 `fill`：填满父容器，自动加 `relative h-full w-full min-w-0 min-h-0`
 *    - 或手动传 `className="h-64"` 之类
 *
 * 2. **横滚场景，内容自己要 `w-max`**（或等价的最小内容宽度）。
 *    没有 `w-max` → 内容被 Viewport width 限制 → 永远没横向溢出 → 没横滚。
 *    这是浏览器 CSS 规则，组件绕不过去。
 *
 * 3. **祖先 flex-item 链上要注意 min-width: auto**。如果祖先某层 flex-item
 *    没显式 `min-w-0`，会被子内容撑大，导致父容器宽度 = 内容宽度，
 *    永远没溢出。推荐用 `size` prop + ResizeObserver 测父尺寸，
 *    避开 CSS 传导链的所有坑。
 */
const ScrollArea = React.forwardRef<
  HTMLDivElement,
  ScrollAreaPrimitive.Root.Props & {
    /** 滚动方向。both = 同时纵横两条滚动条（看板等二维滚动场景）。 */
    orientation?: 'vertical' | 'horizontal' | 'both'
    /** 填满父容器 —— 自动加 relative h-full w-full min-w-0 min-h-0。父必须有确定尺寸。 */
    fill?: boolean
    /** 固定像素尺寸 —— 配合 ResizeObserver 使用，绕过 flex-item min-width:auto 传导坑。 */
    size?: { width: number; height: number }
  }
>(function ScrollArea(
  { className, children, orientation = 'vertical', fill = false, size, style, ...props },
  ref
) {
  const inlineStyle = size ? { ...style, width: size.width, height: size.height } : style

  return (
    <ScrollAreaPrimitive.Root
      ref={ref}
      data-slot="scroll-area"
      className={cn('relative', fill && 'h-full w-full min-h-0 min-w-0', className)}
      style={inlineStyle}
      {...props}
    >
      <ScrollAreaPrimitive.Viewport
        data-slot="scroll-area-viewport"
        className="size-full rounded-[inherit] transition-[color,box-shadow] outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-1"
      >
        {children}
      </ScrollAreaPrimitive.Viewport>
      {orientation !== 'horizontal' && <ScrollBar orientation="vertical" />}
      {orientation !== 'vertical' && <ScrollBar orientation="horizontal" />}
      <ScrollAreaPrimitive.Corner />
    </ScrollAreaPrimitive.Root>
  )
})

function ScrollBar({
  className,
  orientation = 'vertical',
  ...props
}: ScrollAreaPrimitive.Scrollbar.Props) {
  return (
    <ScrollAreaPrimitive.Scrollbar
      data-slot="scroll-area-scrollbar"
      data-orientation={orientation}
      orientation={orientation}
      className={cn(
        'flex touch-none p-px transition-colors select-none data-horizontal:h-2.5 data-horizontal:flex-col data-horizontal:border-t data-horizontal:border-t-transparent data-vertical:h-full data-vertical:w-2.5 data-vertical:border-l data-vertical:border-l-transparent',
        className
      )}
      {...props}
    >
      <ScrollAreaPrimitive.Thumb
        data-slot="scroll-area-thumb"
        className="relative flex-1 rounded-full bg-border"
      />
    </ScrollAreaPrimitive.Scrollbar>
  )
}

export { ScrollArea, ScrollBar }
