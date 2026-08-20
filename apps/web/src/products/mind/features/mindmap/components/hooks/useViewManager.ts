// @ts-nocheck — cloud/collab type debt; runtime gated by no-op shims
import { logger } from "@zoeymind/logger"
import { useEffect, useRef } from "react"
import { mindmapDB } from "@/products/mind/features/mindmap/utils/storage/mindmapDB"
import { useProjectMindMapStore as useMindMapStore } from "@/products/mind/editor-session"
import { useProjectContext } from "@/products/mind/features/mindmap/contexts/ProjectContext"
import { animate } from "motion"
import type { AnimationPlaybackControls } from "motion"
import {
  getAnchoredViewTransform,
  decayVelocity,
  getCanvasWheelDelta,
  getDecayDisplacement,
  getWheelVelocityImpulse,
  getZoomVelocityImpulse,
  isTrackpadWheelStream,
  MIN_RELEASE_SPEED,
  updateDragVelocity,
} from "./interactionMotion"

const PAN_SPRING = {
  type: "spring",
  stiffness: 300,
  damping: 34,
  restDelta: 0.5,
  restSpeed: 8,
} as const

const KEYBOARD_PAN_STEP = 120

export function useViewManager() {
  // 🚀 从 store 获取 mindMap 和 workspaceId，确保状态一致性
  const { workspaceId } = useProjectContext()
  const { mindMap } = useMindMapStore()
  const releaseFrameRef = useRef<number | null>(null)
  const dragSampleRef = useRef({ x: 0, y: 0, time: 0, velocityX: 0, velocityY: 0 })
  const panAnimationRef = useRef<AnimationPlaybackControls | null>(null)
  const panTargetRef = useRef<{ x: number; y: number } | null>(null)
  const lastWheelTimeRef = useRef(0)
  const wheelVelocityRef = useRef({ x: 0, y: 0 })
  const zoomVelocityRef = useRef(0)
  const lastZoomWheelTimeRef = useRef(0)
  useEffect(() => {
    if (!mindMap) return

    const stopPanMotion = () => {
      if (releaseFrameRef.current !== null) cancelAnimationFrame(releaseFrameRef.current)
      panAnimationRef.current?.stop()
      releaseFrameRef.current = null
      panAnimationRef.current = null
      panTargetRef.current = null
      wheelVelocityRef.current = { x: 0, y: 0 }
      zoomVelocityRef.current = 0
    }
    const setViewPosition = (x: number, y: number) => {
      mindMap.view.x = x
      mindMap.view.y = y
      mindMap.view.transform()
      mindMap.view.emitEvent("translate")
    }
    const setZoomAt = (scale: number, anchorX: number, anchorY: number) => {
      const position = getAnchoredViewTransform(
        mindMap.view.x,
        mindMap.view.y,
        mindMap.view.scale,
        scale,
        anchorX,
        anchorY
      )
      mindMap.view.x = position.x
      mindMap.view.y = position.y
      mindMap.view.scale = scale
      mindMap.view.transform()
      mindMap.view.emitEvent("scale")
    }
    const getZoomBounds = () => {
      const minScale = mindMap.opt.minZoomRatio / 100
      const maxScale = mindMap.opt.maxZoomRatio === -1 ? Infinity : mindMap.opt.maxZoomRatio / 100
      return { minScale, maxScale }
    }
    const startZoomDecay = (initialVelocity: number, anchorX: number, anchorY: number) => {
      stopReleaseInertia()
      panAnimationRef.current?.stop()
      panAnimationRef.current = null
      panTargetRef.current = null
      wheelVelocityRef.current = { x: 0, y: 0 }
      if (Math.abs(initialVelocity) < 0.01) return
      const { minScale, maxScale } = getZoomBounds()
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        setZoomAt(
          Math.max(minScale, Math.min(maxScale, mindMap.view.scale + initialVelocity * 0.08)),
          anchorX,
          anchorY
        )
        zoomVelocityRef.current = 0
        return
      }
      let velocity = initialVelocity
      zoomVelocityRef.current = velocity
      let previousTime = performance.now()
      const advance = (time: number) => {
        const elapsed = Math.min(32, Math.max(1, time - previousTime))
        previousTime = time
        const nextVelocity = decayVelocity(velocity, elapsed)
        const scaleDelta = ((velocity + nextVelocity) / 2) * (elapsed / 1000)
        velocity = nextVelocity
        const requestedScale = mindMap.view.scale + scaleDelta
        const nextScale = Math.max(minScale, Math.min(maxScale, requestedScale))
        setZoomAt(nextScale, anchorX, anchorY)
        zoomVelocityRef.current = velocity
        if (nextScale === requestedScale && Math.abs(velocity) >= 0.01) {
          releaseFrameRef.current = requestAnimationFrame(advance)
        } else {
          zoomVelocityRef.current = 0
          releaseFrameRef.current = null
        }
      }
      releaseFrameRef.current = requestAnimationFrame(advance)
    }
    const animateZoomTo = (targetScale: number) => {
      stopPanMotion()
      const { minScale, maxScale } = getZoomBounds()
      const clampedTarget = Math.max(minScale, Math.min(maxScale, targetScale))
      if (clampedTarget === mindMap.view.scale) return
      const anchorX = mindMap.width / 2
      const anchorY = mindMap.height / 2
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        setZoomAt(clampedTarget, anchorX, anchorY)
        return
      }
      panAnimationRef.current = animate(mindMap.view.scale, clampedTarget, {
        ...PAN_SPRING,
        onUpdate: scale => setZoomAt(scale, anchorX, anchorY),
        onComplete: () => {
          panAnimationRef.current = null
        },
      })
    }
    const stopReleaseInertia = () => {
      if (releaseFrameRef.current !== null) cancelAnimationFrame(releaseFrameRef.current)
      releaseFrameRef.current = null
    }
    const startVelocityDecay = (initialVelocityX: number, initialVelocityY: number) => {
      stopReleaseInertia()
      zoomVelocityRef.current = 0
      if (
        window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
        (Math.abs(initialVelocityX) < MIN_RELEASE_SPEED &&
          Math.abs(initialVelocityY) < MIN_RELEASE_SPEED)
      ) {
        return
      }
      let velocityX = initialVelocityX
      let velocityY = initialVelocityY
      wheelVelocityRef.current = { x: velocityX, y: velocityY }
      let previousTime = performance.now()
      const advance = (time: number) => {
        const elapsed = Math.min(32, Math.max(1, time - previousTime))
        previousTime = time
        const dx = getDecayDisplacement(velocityX, elapsed)
        const dy = getDecayDisplacement(velocityY, elapsed)
        velocityX = decayVelocity(velocityX, elapsed)
        velocityY = decayVelocity(velocityY, elapsed)
        wheelVelocityRef.current = { x: velocityX, y: velocityY }
        if (dx !== 0 || dy !== 0) {
          setViewPosition(mindMap.view.x + dx, mindMap.view.y + dy)
          releaseFrameRef.current = requestAnimationFrame(advance)
        } else {
          wheelVelocityRef.current = { x: 0, y: 0 }
          releaseFrameRef.current = null
        }
      }
      releaseFrameRef.current = requestAnimationFrame(advance)
    }
    const animatePanBy = (deltaX: number, deltaY: number) => {
      stopReleaseInertia()
      const base = panTargetRef.current ?? { x: mindMap.view.x, y: mindMap.view.y }
      const target = { x: base.x + deltaX, y: base.y + deltaY }
      const from = { x: mindMap.view.x, y: mindMap.view.y }
      panTargetRef.current = target
      panAnimationRef.current?.stop()
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        setViewPosition(target.x, target.y)
        panTargetRef.current = null
        return
      }
      panAnimationRef.current = animate(0, 1, {
        ...PAN_SPRING,
        onUpdate: progress => {
          setViewPosition(
            from.x + (target.x - from.x) * progress,
            from.y + (target.y - from.y) * progress
          )
        },
        onComplete: () => {
          panAnimationRef.current = null
          panTargetRef.current = null
        },
      })
    }
    const handleMouseDown = (event: MouseEvent) => {
      stopPanMotion()
      dragSampleRef.current = {
        x: event.clientX,
        y: event.clientY,
        time: performance.now(),
        velocityX: 0,
        velocityY: 0,
      }
    }
    const handleDrag = (event: MouseEvent) => {
      dragSampleRef.current = updateDragVelocity(
        dragSampleRef.current,
        event.clientX,
        event.clientY,
        performance.now()
      )
    }
    const handleMouseUp = () => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
      const sample = dragSampleRef.current
      if (performance.now() - sample.time > 80) return
      if (
        Math.abs(sample.velocityX) < MIN_RELEASE_SPEED &&
        Math.abs(sample.velocityY) < MIN_RELEASE_SPEED
      ) {
        return
      }

      startVelocityDecay(sample.velocityX, sample.velocityY)
    }

    const handleWheelCapture = (event: WheelEvent) => {
      const modeScale = event.deltaMode === WheelEvent.DOM_DELTA_LINE ? 16 : 1
      if (event.ctrlKey || event.metaKey) {
        if (event.deltaY === 0) return
        event.preventDefault()
        event.stopImmediatePropagation()
        const now = performance.now()
        const elapsed = now - lastZoomWheelTimeRef.current
        lastZoomWheelTimeRef.current = now
        const deltaY = event.deltaY * modeScale
        const anchor = mindMap.toPos(event.clientX, event.clientY)
        if (isTrackpadWheelStream(deltaY, elapsed)) {
          stopPanMotion()
          const { minScale, maxScale } = getZoomBounds()
          setZoomAt(
            Math.max(minScale, Math.min(maxScale, mindMap.view.scale - deltaY * 0.0015)),
            anchor.x,
            anchor.y
          )
          return
        }
        const velocity = zoomVelocityRef.current * 0.45 + getZoomVelocityImpulse(deltaY)
        startZoomDecay(velocity, anchor.x, anchor.y)
        return
      }
      const delta = getCanvasWheelDelta(
        event.deltaX * modeScale,
        event.deltaY * modeScale,
        event.shiftKey
      )
      if (delta.x === 0 && delta.y === 0) return
      event.preventDefault()
      event.stopImmediatePropagation()

      const now = performance.now()
      const elapsed = now - lastWheelTimeRef.current
      lastWheelTimeRef.current = now
      const dominantDelta = Math.abs(delta.x) > Math.abs(delta.y) ? delta.x : delta.y
      if (isTrackpadWheelStream(dominantDelta, elapsed)) {
        stopPanMotion()
        mindMap.view.translateXY(-delta.x, -delta.y)
        return
      }
      const velocityX = wheelVelocityRef.current.x * 0.45 + getWheelVelocityImpulse(delta.x)
      const velocityY = wheelVelocityRef.current.y * 0.45 + getWheelVelocityImpulse(delta.y)
      startVelocityDecay(velocityX, velocityY)
    }

    const panLeft = () => animatePanBy(KEYBOARD_PAN_STEP, 0)
    const panRight = () => animatePanBy(-KEYBOARD_PAN_STEP, 0)
    const panUp = () => animatePanBy(0, KEYBOARD_PAN_STEP)
    const panDown = () => animatePanBy(0, -KEYBOARD_PAN_STEP)
    const zoomIn = () => animateZoomTo(mindMap.view.scale + mindMap.opt.scaleRatio)
    const zoomOut = () => animateZoomTo(mindMap.view.scale - mindMap.opt.scaleRatio)
    const zoomTo = (scale: number) => animateZoomTo(scale)
    const handleZoomShortcut = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return
      if (event.key !== "+" && event.key !== "=" && event.key !== "-") return
      event.preventDefault()
      event.stopImmediatePropagation()
      if (event.key === "-") zoomOut()
      else zoomIn()
    }

    mindMap.el.addEventListener("wheel", handleWheelCapture, { capture: true, passive: false })
    mindMap.keyCommand.addShortcut("Shift+Left", panLeft)
    mindMap.keyCommand.addShortcut("Shift+Right", panRight)
    mindMap.keyCommand.addShortcut("Shift+Up", panUp)
    mindMap.keyCommand.addShortcut("Shift+Down", panDown)
    window.addEventListener("keydown", handleZoomShortcut, true)
    mindMap.on("smooth_zoom_in", zoomIn)
    mindMap.on("smooth_zoom_out", zoomOut)
    mindMap.on("smooth_zoom_to", zoomTo)
    mindMap.event.on("mousedown", handleMouseDown)
    mindMap.event.on("drag", handleDrag)
    mindMap.event.on("mouseup", handleMouseUp)
    mindMap.on("scrollbar_interaction_start", stopPanMotion)
    return () => {
      stopPanMotion()
      mindMap.el.removeEventListener("wheel", handleWheelCapture, { capture: true })
      mindMap.keyCommand.removeShortcut("Shift+Left", panLeft)
      mindMap.keyCommand.removeShortcut("Shift+Right", panRight)
      mindMap.keyCommand.removeShortcut("Shift+Up", panUp)
      mindMap.keyCommand.removeShortcut("Shift+Down", panDown)
      window.removeEventListener("keydown", handleZoomShortcut, true)
      mindMap.off("smooth_zoom_in", zoomIn)
      mindMap.off("smooth_zoom_out", zoomOut)
      mindMap.off("smooth_zoom_to", zoomTo)
      mindMap.event.off("mousedown", handleMouseDown)
      mindMap.event.off("drag", handleDrag)
      mindMap.event.off("mouseup", handleMouseUp)
      mindMap.off("scrollbar_interaction_start", stopPanMotion)
    }
  }, [mindMap])
  useEffect(() => {
    if (!mindMap) return

    // 监听视图数据变化
    const handleViewDataChange = () => {
      try {
        const viewData = mindMap.view.getTransformData()
        // 使用 IndexedDB 保存视图数据
        mindmapDB.saveViewData(viewData, workspaceId).catch(error => {
          logger.error("保存视图数据失败:", error)
        })
      } catch (error) {
        logger.error("保存视图数据失败:", error)
      }
    }

    mindMap.on("view_data_change", handleViewDataChange)

    return () => {
      mindMap.off("view_data_change", handleViewDataChange)
    }
  }, [mindMap, workspaceId])
}
