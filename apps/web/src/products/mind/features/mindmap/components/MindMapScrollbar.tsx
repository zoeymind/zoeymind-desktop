import { useEffect, useRef, useState } from "react"
import { cn } from "@/shared/app-shared"
import { useProjectMindMapStore as useMindMapStore } from "@/products/mind/editor-session"
import { animate, type AnimationPlaybackControls } from "motion"
import type MindMap from "simple-mind-map"
import {
  decayVelocity,
  getDecayDisplacement,
  getScrollbarPageTarget,
  getScrollbarWheelDelta,
  MIN_RELEASE_SPEED,
} from "./hooks/interactionMotion"

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
interface ScrollbarController {
  setScrollBarWrapSize(width: number, height: number): void
  calculationScrollbar(): ScrollbarData
  updateMindMapView(type: "vertical" | "horizontal", offset: number): void
}

function getScrollbar(mindMap: MindMap | null): ScrollbarController | null {
  return mindMap?.scrollbar ? (mindMap.scrollbar as unknown as ScrollbarController) : null
}

interface MindMapScrollbarProps {
  className?: string
}

export function MindMapScrollbar({ className }: MindMapScrollbarProps) {
  // 从store获取mindMap实例
  const { mindMap } = useMindMapStore()
  const [scrollbarData, setScrollbarData] = useState<ScrollbarData | null>(null)
  const [, setContainerSize] = useState({ width: 0, height: 0 })
  const [isDragging, setIsDragging] = useState<"vertical" | "horizontal" | null>(null)
  const trackAnimationRef = useRef<AnimationPlaybackControls | null>(null)
  const kineticFrameRef = useRef<number | null>(null)
  const verticalTrackRef = useRef<HTMLDivElement>(null)
  const horizontalTrackRef = useRef<HTMLDivElement>(null)
  const scrollbarDataRef = useRef<ScrollbarData | null>(null)
  const dragVelocityRef = useRef({ position: 0, time: 0, velocity: 0 })
  const wheelVelocityRef = useRef({ vertical: 0, horizontal: 0 })

  const stopKineticMotion = (resetVelocity = true) => {
    if (kineticFrameRef.current !== null) cancelAnimationFrame(kineticFrameRef.current)
    kineticFrameRef.current = null
    if (resetVelocity) wheelVelocityRef.current = { vertical: 0, horizontal: 0 }
  }

  const updateScrollbarOffset = (type: "vertical" | "horizontal", offset: number): number => {
    const data = scrollbarDataRef.current
    const track = type === "vertical" ? verticalTrackRef.current : horizontalTrackRef.current
    const scrollbar = getScrollbar(mindMap)
    if (!scrollbar || !data || !track) return offset
    const thumbPercent = type === "vertical" ? data.vertical.height : data.horizontal.width
    const trackLength = type === "vertical" ? track.clientHeight : track.clientWidth
    const maxOffset = Math.max(0, trackLength * (1 - thumbPercent / 100))
    const clamped = Math.max(0, Math.min(maxOffset, offset))
    scrollbar.updateMindMapView(type, clamped)
    return clamped
  }

  const startKineticMotion = (type: "vertical" | "horizontal", initialVelocity: number) => {
    stopKineticMotion(false)
    if (
      Math.abs(initialVelocity) < MIN_RELEASE_SPEED ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return
    }
    const track = type === "vertical" ? verticalTrackRef.current : horizontalTrackRef.current
    const scrollbar = getScrollbar(mindMap)
    if (!track || !scrollbar) return
    const currentData = scrollbar.calculationScrollbar()
    let currentOffset =
      ((type === "vertical" ? currentData.vertical.top : currentData.horizontal.left) / 100) *
      (type === "vertical" ? track.clientHeight : track.clientWidth)
    let velocity = initialVelocity
    wheelVelocityRef.current[type] = initialVelocity
    let previousTime = performance.now()
    const advance = (time: number) => {
      const elapsed = Math.min(32, Math.max(1, time - previousTime))
      previousTime = time
      const displacement = getDecayDisplacement(velocity, elapsed)
      velocity = decayVelocity(velocity, elapsed)
      wheelVelocityRef.current[type] = velocity
      const requestedOffset = currentOffset + displacement
      const nextOffset = updateScrollbarOffset(type, requestedOffset)
      currentOffset = nextOffset
      const hitBoundary = nextOffset !== requestedOffset
      if (!hitBoundary && Math.abs(velocity) >= MIN_RELEASE_SPEED) {
        kineticFrameRef.current = requestAnimationFrame(advance)
      } else {
        wheelVelocityRef.current[type] = 0
        kineticFrameRef.current = null
      }
    }
    kineticFrameRef.current = requestAnimationFrame(advance)
  }

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
    window.addEventListener("resize", updateContainerSize)

    // 监听滚动条数据变化
    const handleScrollbarChange = (data: ScrollbarData) => {
      scrollbarDataRef.current = data
      setScrollbarData(data)
    }

    mindMap.on("scrollbar_change", handleScrollbarChange)

    // 初始计算滚动条数据
    const initialTimer = window.setTimeout(() => {
      if (mindMap.scrollbar) {
        const data = mindMap.scrollbar.calculationScrollbar()
        scrollbarDataRef.current = data
        setScrollbarData(data)
      }
    }, 100)

    return () => {
      stopKineticMotion()
      trackAnimationRef.current?.stop()
      trackAnimationRef.current = null
      window.clearTimeout(initialTimer)
      window.removeEventListener("resize", updateContainerSize)
      mindMap.off("scrollbar_change", handleScrollbarChange)
    }
  }, [mindMap])

  // 点击轨道空白时按原生滚动条语义翻一页，不直接跳到点击坐标。
  const handleScrollbarClick = (e: React.MouseEvent, type: "vertical" | "horizontal") => {
    const scrollbar = getScrollbar(mindMap)
    if (!mindMap || !scrollbar || !scrollbarData) return
    const rect = e.currentTarget.getBoundingClientRect()
    const trackLength = type === "vertical" ? rect.height : rect.width
    const clickOffset = type === "vertical" ? e.clientY - rect.top : e.clientX - rect.left
    const startPercent =
      type === "vertical" ? scrollbarData.vertical.top : scrollbarData.horizontal.left
    const sizePercent =
      type === "vertical" ? scrollbarData.vertical.height : scrollbarData.horizontal.width
    const currentOffset = (startPercent / 100) * trackLength
    const targetOffset = getScrollbarPageTarget(trackLength, startPercent, sizePercent, clickOffset)
    if (targetOffset === currentOffset) return

    mindMap.emit("scrollbar_interaction_start")
    stopKineticMotion()
    trackAnimationRef.current?.stop()
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      scrollbar.updateMindMapView(type, targetOffset)
      return
    }
    trackAnimationRef.current = animate(currentOffset, targetOffset, {
      type: "spring",
      stiffness: 300,
      damping: 34,
      restDelta: 0.5,
      restSpeed: 8,
      onUpdate: value => {
        scrollbar.updateMindMapView(type, value)
      },
      onComplete: () => {
        trackAnimationRef.current = null
      },
    })
  }

  // 处理滚动条拖动开始
  const handleMouseDown = (e: React.MouseEvent, type: "vertical" | "horizontal") => {
    if (!mindMap?.scrollbar) return
    stopKineticMotion()
    trackAnimationRef.current?.stop()
    trackAnimationRef.current = null
    mindMap.emit("scrollbar_interaction_start")
    setIsDragging(type)
    const initialPosition = type === "vertical" ? e.clientY : e.clientX
    dragVelocityRef.current = { position: initialPosition, time: performance.now(), velocity: 0 }
    mindMap.scrollbar.onMousedown(e.nativeEvent, type)

    const handleMouseMove = (event: MouseEvent) => {
      event.preventDefault()
      const position = type === "vertical" ? event.clientY : event.clientX
      const now = performance.now()
      const sample = dragVelocityRef.current
      const elapsed = Math.max(8, now - sample.time)
      const instantVelocity = ((position - sample.position) / elapsed) * 1000
      dragVelocityRef.current = {
        position,
        time: now,
        velocity: sample.velocity * 0.65 + instantVelocity * 0.35,
      }
    }

    const handleMouseUp = () => {
      setIsDragging(null)
      const sample = dragVelocityRef.current
      if (performance.now() - sample.time <= 80) startKineticMotion(type, sample.velocity)
      document.removeEventListener("mousemove", handleMouseMove)
      document.removeEventListener("mouseup", handleMouseUp)
    }

    document.addEventListener("mousemove", handleMouseMove)
    document.addEventListener("mouseup", handleMouseUp)
  }

  const handleTrackWheel = (e: React.WheelEvent, type: "vertical" | "horizontal") => {
    const data = scrollbarDataRef.current
    const track = type === "vertical" ? verticalTrackRef.current : horizontalTrackRef.current
    if (!mindMap?.scrollbar || !data || !track) return
    e.preventDefault()
    e.stopPropagation()
    mindMap.emit("scrollbar_interaction_start")
    const rawDelta = type === "vertical" ? e.deltaY : e.deltaX !== 0 ? e.deltaX : e.deltaY
    if (rawDelta === 0) return
    const modeScale = e.deltaMode === WheelEvent.DOM_DELTA_LINE ? 16 : 1
    const thumbPercent = type === "vertical" ? data.vertical.height : data.horizontal.width
    const viewportLength = type === "vertical" ? mindMap.height : mindMap.width
    const thumbDelta = getScrollbarWheelDelta(
      rawDelta * modeScale,
      type === "vertical" ? track.clientHeight : track.clientWidth,
      thumbPercent,
      viewportLength
    )
    const impulseVelocity = thumbDelta * 20
    const velocity = wheelVelocityRef.current[type] * 0.45 + impulseVelocity
    startKineticMotion(type, velocity)
  }

  if (!scrollbarData) return null

  return (
    <div className={cn("absolute inset-0 pointer-events-none", className)}>
      {/* 垂直滚动条 */}
      <div
        ref={verticalTrackRef}
        onWheel={e => handleTrackWheel(e, "vertical")}
        className="pointer-events-auto absolute bottom-2 right-1 top-2 w-2"
        onClick={e => handleScrollbarClick(e, "vertical")}
      >
        <div
          className={cn(
            "pointer-events-auto absolute right-0 w-2 cursor-pointer rounded-full bg-canvas-scrollbar transition-colors hover:bg-canvas-scrollbar-hover",
            isDragging === "vertical" && "bg-canvas-scrollbar-active"
          )}
          style={{
            top: `${scrollbarData.vertical.top}%`,
            height: `${scrollbarData.vertical.height}%`,
          }}
          onMouseDown={e => handleMouseDown(e, "vertical")}
          onClick={e => e.stopPropagation()}
        />
      </div>

      {/* 水平滚动条 */}
      <div
        className="pointer-events-auto absolute bottom-1 left-2 right-2 h-2"
        ref={horizontalTrackRef}
        onWheel={e => handleTrackWheel(e, "horizontal")}
        onClick={e => handleScrollbarClick(e, "horizontal")}
      >
        <div
          className={cn(
            "pointer-events-auto absolute bottom-0 h-2 cursor-pointer rounded-full bg-canvas-scrollbar transition-colors hover:bg-canvas-scrollbar-hover",
            isDragging === "horizontal" && "bg-canvas-scrollbar-active"
          )}
          style={{
            left: `${scrollbarData.horizontal.left}%`,
            width: `${scrollbarData.horizontal.width}%`,
          }}
          onMouseDown={e => handleMouseDown(e, "horizontal")}
          onClick={e => e.stopPropagation()}
        />
      </div>
    </div>
  )
}
