import { logger } from "@zoeymind/logger"
import { useState, useCallback, useEffect, useRef } from "react"
import { useProjectMindMapStore as useMindMapStore } from "@/products/mind/editor-session"
import type MindMap from "simple-mind-map"

function configurePanMode(mindMap: MindMap, enabled: boolean) {
  mindMap.opt.useLeftKeySelectionRightKeyDrag = !enabled
  if (mindMap.el) mindMap.el.style.cursor = enabled ? "grab" : ""
}

function setCanvasCursor(element: HTMLElement | null | undefined, cursor: string) {
  if (element) element.style.cursor = cursor
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
      configurePanMode(mindMap, newPanMode)
      logger.info(newPanMode ? "已启用手掌拖动模式" : "已恢复默认选择模式")
    } catch (error) {
      logger.error("切换拖动模式失败:", error)
    }
  }, [mindMap, isPanMode])

  const handleDragStart = useCallback(() => {
    if (isRightDragging) return
    setIsRightDragging(true)
    setCanvasCursor(mindMap?.el, "grabbing")
    logger.info("右键拖动开始")
  }, [mindMap, isRightDragging])

  const handleDragEnd = useCallback(() => {
    if (isRightDragging) {
      setIsRightDragging(false)
      if (!isPanMode) setCanvasCursor(mindMap?.el, "")
      logger.info("右键拖动结束")
    }
    isDragMovingRef.current = false
  }, [mindMap, isPanMode, isRightDragging])

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
            handleDragStart()
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
          handleDragEnd()
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
    canvas.addEventListener("mousedown", handleMouseDown)
    canvas.addEventListener("mousemove", handleMouseMove)
    canvas.addEventListener("mouseup", handleMouseUp)
    canvas.addEventListener("contextmenu", handleContextMenu)

    return () => {
      canvas.removeEventListener("mousedown", handleMouseDown)
      canvas.removeEventListener("mousemove", handleMouseMove)
      canvas.removeEventListener("mouseup", handleMouseUp)
      canvas.removeEventListener("contextmenu", handleContextMenu)
    }
  }, [mindMap, isPanMode, isRightDragging, handleDragStart, handleDragEnd])

  return {
    isPanMode,
    isRightDragging,
    togglePanMode,
    // 计算按钮是否应该高亮：手掌模式或右键拖动中
    isActive: isPanMode || isRightDragging,
  }
}
