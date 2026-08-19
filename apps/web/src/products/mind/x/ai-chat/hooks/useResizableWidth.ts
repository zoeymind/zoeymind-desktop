// @ts-nocheck — desktop mirror of cloud AI chat; runtime bridged via bridge.tsx
/**
 * useResizableWidth — 单向 (left handle drag-left → 变宽) 浮动面板 resize hook.
 *
 * 原 UnifiedAIPanel / AIchatV2 各自手写了一份 mousedown / mousemove / mouseup 逻辑,
 * 这里统一抽出. react-resizable-panels 适配的是 PanelGroup 多面板布局, 不适合这种
 * `position: fixed` 单边 handle 的浮窗场景, 所以我们用自家 hook 替代库.
 */

import { useCallback, useEffect, useRef, useState } from 'react'

interface UseResizableWidthOptions {
  initial: number
  min: number
  max: number
}

export interface UseResizableWidthResult {
  width: number
  isDragging: boolean
  /** 把这个挂到 handle 的 onMouseDown 上 */
  onMouseDown: (e: React.MouseEvent) => void
}

export function useResizableWidth({
  initial,
  min,
  max
}: UseResizableWidthOptions): UseResizableWidthResult {
  const [width, setWidth] = useState(initial)
  const [isDragging, setIsDragging] = useState(false)
  const dragStartXRef = useRef(0)
  const dragStartWidthRef = useRef(0)

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      setIsDragging(true)
      dragStartXRef.current = e.clientX
      dragStartWidthRef.current = width
    },
    [width]
  )

  useEffect(() => {
    if (!isDragging) return

    const onMouseMove = (e: MouseEvent) => {
      const deltaX = dragStartXRef.current - e.clientX
      const next = dragStartWidthRef.current + deltaX
      if (next >= min && next <= max) {
        setWidth(next)
      }
    }
    const onMouseUp = () => setIsDragging(false)

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [isDragging, min, max])

  return { width, isDragging, onMouseDown }
}
