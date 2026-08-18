import { logger } from '@zoeymind/logger'
import { useState, useCallback, useEffect, useRef } from 'react'
import { useMindMapStore } from '@/products/mind/features/mindmap/stores/mindmap-store'

// 节流函数
const throttle = <T extends (...args: unknown[]) => void>(fn: T, delay: number): T => {
  let lastCall = 0
  return ((...args: Parameters<T>) => {
    const now = Date.now()
    if (now - lastCall >= delay) {
      lastCall = now
      fn(...args)
    }
  }) as T
}

export function usePanTool() {
  // 从 store 获取 mindMap 实例
  const { mindMap } = useMindMapStore()
  const [isPanMode, setIsPanMode] = useState(false)
  const [isRightDragging, setIsRightDragging] = useState(false)
  const dragStartTimeRef = useRef<number>(0)
  const isDragMovingRef = useRef(false)

  // 切换拖动模式
  const togglePanMode = useCallback(() => {
    if (!mindMap) return

    const newPanMode = !isPanMode
    setIsPanMode(newPanMode)

    try {
      if (newPanMode) {
        // 启用手掌拖动模式：使用库原生的左键拖动配置
        mindMap.opt.useLeftKeySelectionRightKeyDrag = false
        // 设置画布样式为抓手
        if (mindMap.el) {
          mindMap.el.style.cursor = 'grab'
        }
        logger.info('已启用手掌拖动模式')
      } else {
        // 恢复默认模式：左键选择，右键拖拽
        mindMap.opt.useLeftKeySelectionRightKeyDrag = true
        // 恢复默认光标
        if (mindMap.el) {
          mindMap.el.style.cursor = ''
        }
        logger.info('已恢复默认选择模式')
      }
    } catch (error) {
      logger.error('切换拖动模式失败:', error)
    }
  }, [mindMap, isPanMode])

  // 节流的拖动开始处理
  const throttledDragStart = useCallback(
    throttle(() => {
      if (!isRightDragging) {
        setIsRightDragging(true)
        if (mindMap?.el) {
          mindMap.el.style.cursor = 'grabbing'
        }
        logger.info('右键拖动开始')
      }
    }, 100),
    [mindMap, isRightDragging]
  )

  // 节流的拖动结束处理
  const throttledDragEnd = useCallback(
    throttle(() => {
      if (isRightDragging) {
        setIsRightDragging(false)
        if (mindMap?.el && !isPanMode) {
          mindMap.el.style.cursor = ''
        }
        logger.info('右键拖动结束')
      }
      isDragMovingRef.current = false
    }, 100),
    [mindMap, isPanMode, isRightDragging]
  )

  // 监听右键拖动状态
  useEffect(() => {
    if (!mindMap?.el) return

    const handleMouseDown = (e: MouseEvent) => {
      // 检测右键按下（button === 2）
      if (e.button === 2 && mindMap.opt.useLeftKeySelectionRightKeyDrag) {
        dragStartTimeRef.current = Date.now()
        isDragMovingRef.current = false

        // 延迟检测是否真的在拖动
        setTimeout(() => {
          if (isDragMovingRef.current) {
            throttledDragStart()
          }
        }, 50)
      }
    }

    const handleMouseMove = () => {
      // 如果右键按下且移动了一定距离，认为是拖动
      if (dragStartTimeRef.current > 0 && !isDragMovingRef.current) {
        isDragMovingRef.current = true
      }
    }

    const handleMouseUp = (e: MouseEvent) => {
      // 检测右键释放
      if (e.button === 2) {
        const dragDuration = Date.now() - dragStartTimeRef.current

        // 只有真正拖动过才触发结束事件
        if (isDragMovingRef.current && dragDuration > 100) {
          throttledDragEnd()
        }

        dragStartTimeRef.current = 0
        isDragMovingRef.current = false
      }
    }

    const handleContextMenu = (e: MouseEvent) => {
      // 如果正在拖动，阻止右键菜单
      if (isDragMovingRef.current || isRightDragging) {
        e.preventDefault()
      }
    }

    // 添加事件监听
    const canvas = mindMap.el
    canvas.addEventListener('mousedown', handleMouseDown)
    canvas.addEventListener('mousemove', handleMouseMove)
    canvas.addEventListener('mouseup', handleMouseUp)
    canvas.addEventListener('contextmenu', handleContextMenu)

    return () => {
      canvas.removeEventListener('mousedown', handleMouseDown)
      canvas.removeEventListener('mousemove', handleMouseMove)
      canvas.removeEventListener('mouseup', handleMouseUp)
      canvas.removeEventListener('contextmenu', handleContextMenu)
    }
  }, [mindMap, isPanMode, isRightDragging, throttledDragStart, throttledDragEnd])

  return {
    isPanMode,
    isRightDragging,
    togglePanMode,
    // 计算按钮是否应该高亮：手掌模式或右键拖动中
    isActive: isPanMode || isRightDragging
  }
}
