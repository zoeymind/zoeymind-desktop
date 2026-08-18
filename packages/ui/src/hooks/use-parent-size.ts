import { useEffect, useRef, useState } from 'react'

/**
 * 用 ResizeObserver 观察一个 wrapper 的父容器实时尺寸。
 *
 * 场景：ScrollArea / 图表 / 表格等需要"父的真实可视尺寸"来正确出滚动条 / 布局
 *      的组件。CSS 高度/宽度传导会被祖先 flex-item 的 `min-width: auto` /
 *      `min-height: auto` 隐式规则搞坏（父被子内容撑大 → "父宽" 变成了内容宽 →
 *      overflow 判定失效）。ResizeObserver 直接读浏览器算好的布局尺寸，
 *      绕过这个坑。
 *
 * @example
 * ```tsx
 * const { ref, width, height } = useParentSize()
 * return (
 *   <div ref={ref} className="h-full w-full">
 *     {width > 0 && (
 *       <ScrollArea size={{ width, height }} orientation="both">
 *         <div className="w-max">...</div>
 *       </ScrollArea>
 *     )}
 *   </div>
 * )
 * ```
 */
export function useParentSize<T extends HTMLElement = HTMLDivElement>(): {
  ref: React.RefObject<T | null>
  width: number
  height: number
} {
  const ref = useRef<T>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const parent = el.parentElement
    if (!parent) return

    const observer = new ResizeObserver(entries => {
      const entry = entries[0]
      if (!entry) return
      const { width, height } = entry.contentRect
      setSize({ width, height })
    })
    observer.observe(parent)
    return () => observer.disconnect()
  }, [])

  return { ref, width: size.width, height: size.height }
}
