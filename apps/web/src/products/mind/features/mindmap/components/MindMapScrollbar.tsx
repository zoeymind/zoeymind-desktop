// @ts-nocheck — cloud/collab type debt; runtime gated by no-op shims
import { useEffect, useState } from 'react'
import { cn } from '@/shared/app-shared'
import { useMindMapStore } from '@/products/mind/features/mindmap/stores/mindmap-store'

interface ScrollbarData {
  vertical: {
    top: number
    height: number
  }
  horizontal: {
    left: number
    width: number
  }
}

interface MindMapScrollbarProps {
  className?: string
}

export function MindMapScrollbar({ className }: MindMapScrollbarProps) {
  // 从store获取mindMap实例
  const { mindMap } = useMindMapStore()
  const [scrollbarData, setScrollbarData] = useState<ScrollbarData | null>(null)
  const [, setContainerSize] = useState({ width: 0, height: 0 })
  const [isDragging, setIsDragging] = useState<'vertical' | 'horizontal' | null>(null)

  useEffect(() => {
    if (!mindMap || !mindMap.scrollbar) return

    // 获取容器元素
    const container = mindMap.el?.parentElement
    if (!container) return

    // 设置滚动条容器大小
    const updateContainerSize = () => {
      const { width, height } = container.getBoundingClientRect()
      setContainerSize({ width, height })
      mindMap.scrollbar?.setScrollBarWrapSize(width, height)
    }

    // 初始化时更新容器大小
    updateContainerSize()

    // 监听窗口大小变化
    window.addEventListener('resize', updateContainerSize)

    // 监听滚动条数据变化
    const handleScrollbarChange = (data: ScrollbarData) => {
      setScrollbarData(data)
    }

    mindMap.on('scrollbar_change', handleScrollbarChange)

    // 初始计算滚动条数据
    setTimeout(() => {
      if (mindMap.scrollbar) {
        const data = mindMap.scrollbar.calculationScrollbar()
        setScrollbarData(data)
      }
    }, 100)

    return () => {
      window.removeEventListener('resize', updateContainerSize)
      mindMap.off('scrollbar_change', handleScrollbarChange)
    }
  }, [mindMap])

  // 处理滚动条点击事件
  const handleScrollbarClick = (e: React.MouseEvent, type: 'vertical' | 'horizontal') => {
    if (!mindMap?.scrollbar) return
    mindMap.scrollbar.onClick(e.nativeEvent, type)
  }

  // 处理滚动条拖动开始
  const handleMouseDown = (e: React.MouseEvent, type: 'vertical' | 'horizontal') => {
    if (!mindMap?.scrollbar) return
    setIsDragging(type)
    mindMap.scrollbar.onMousedown(e.nativeEvent, type)

    // 添加全局鼠标事件监听
    const handleMouseMove = (e: MouseEvent) => {
      if (!mindMap?.scrollbar) return
      e.preventDefault()
    }

    const handleMouseUp = () => {
      setIsDragging(null)
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }

  if (!scrollbarData) return null

  return (
    <div className={cn('absolute inset-0 pointer-events-none', className)}>
      {/* 垂直滚动条 */}
      <div
        className="absolute right-0 top-0 w-2 h-full"
        onClick={e => handleScrollbarClick(e, 'vertical')}
      >
        <div
          className={cn(
            'absolute right-0 w-2 bg-black/30 backdrop-blur-sm rounded-full pointer-events-auto cursor-pointer hover:bg-black/40 transition-colors',
            isDragging === 'vertical' && 'bg-black/50 shadow-lg'
          )}
          style={{
            top: `${scrollbarData.vertical.top}%`,
            height: `${scrollbarData.vertical.height}%`
          }}
          onMouseDown={e => handleMouseDown(e, 'vertical')}
        />
      </div>

      {/* 水平滚动条 */}
      <div
        className="absolute left-0 bottom-6 w-full h-2"
        onClick={e => handleScrollbarClick(e, 'horizontal')}
      >
        <div
          className={cn(
            'absolute bottom-0 h-2 bg-black/30 backdrop-blur-sm rounded-full pointer-events-auto cursor-pointer hover:bg-black/40 transition-colors',
            isDragging === 'horizontal' && 'bg-black/50 shadow-lg'
          )}
          style={{
            left: `${scrollbarData.horizontal.left}%`,
            width: `${scrollbarData.horizontal.width}%`
          }}
          onMouseDown={e => handleMouseDown(e, 'horizontal')}
        />
      </div>
    </div>
  )
}