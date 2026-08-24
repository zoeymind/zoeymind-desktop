"use client"
// beui.dev/components/blocks/morphing-tabs

import { X } from "lucide-react"
import {
  AnimatePresence,
  animate as animateValue,
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
  type MotionValue,
} from "motion/react"
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react"
import { createPortal } from "react-dom"
import { EASE_OUT, SPRING_GLIDE, SPRING_PRESS } from "@/lib/ease"
import { TOUCH_GESTURE_CLASS, capturePointer } from "@/lib/touch"
import { cn } from "@/lib/utils"
import { Button } from "@zoeymind/ui"

export type MorphingTabsItem = {
  id: string
  label: string
  icon?: ReactNode
  content: ReactNode
  disabled?: boolean
  /** [ZoeyMind] 非拖拽、非关闭, 但仍可点击激活 (Home tab 用). */
  pinned?: boolean
}

export type MorphingTabsClassNames = {
  root?: string
  rail?: string
  tab?: string
  activeTab?: string
  icon?: string
  label?: string
  close?: string
  content?: string
}

export interface MorphingTabsProps {
  items: MorphingTabsItem[]
  value?: string | null
  defaultValue?: string | null
  onValueChange?: (id: string | null) => void
  /** Called once after a pointer drag or keyboard reorder completes. */
  onOrderChange?: (ids: string[]) => void
  /** Enables the close affordance on every tab when provided. */
  onClose?: (id: string) => void
  ariaLabel?: string
  className?: string
  classNames?: MorphingTabsClassNames
  /** [ZoeyMind] 左侧额外留白 (macOS 红绿灯). tab 位置偏移这么多, 但液态 panel 仍 x=0 起. */
  startInset?: number
  /** [ZoeyMind] 右侧额外留白 ('+' 按钮 等). */
  endInset?: number
  /** [ZoeyMind] 渲染在最后一个 tab 右侧 (跟随 tab 移动), 用于 '+' 按钮. */
  trailing?: ReactNode
}

type DragSession = {
  id: string
  pointerId: number
  originX: number
  startLeft: number
  startIndex: number
  targetIndex: number
  moved: boolean
  finishing: boolean
  startOrder: string[]
  slotLefts: number[]
}

type SpringTabProps = {
  id: string
  targetLeft: number
  dragging: boolean
  dragLeft: MotionValue<number>
  surfaceLeft: MotionValue<number>
  reduce: boolean
  active: boolean
  anyDragging: boolean
  surfaceHost: HTMLDivElement | null
  surfaceWidth: number
  tabWidth: number
  surfaceClassName?: string
  zIndex: number
  className: string
  children: ReactNode
  registerPosition: (id: string, position: MotionValue<number> | null) => void
  onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void
  onPointerMove: (event: ReactPointerEvent<HTMLDivElement>) => void
  onPointerUp: (event: ReactPointerEvent<HTMLDivElement>) => void
  onPointerCancel: (event: ReactPointerEvent<HTMLDivElement>) => void
  onLostPointerCapture: (event: ReactPointerEvent<HTMLDivElement>) => void
}

// [ZoeyMind 桌面端] 更紧凑: RAIL_HEIGHT=40, TAB_HEIGHT=26 (tab 视觉更小).
const DRAG_THRESHOLD = 5
const MAX_TAB_WIDTH = 120
const MIN_TAB_WIDTH = 80
const TAB_HEIGHT = 36
const TAB_TOP = 4
const TAB_RADIUS = 14
const RAIL_HEIGHT = 40
const SURFACE_INSET = 0
const LIQUID_JOIN = 10
const PANEL_RADIUS = 10
/** pinned (Home) tab 固定宽度, icon-only. */
const PINNED_TAB_WIDTH = 32

function sameOrder(a: string[], b: string[]) {
  return a.length === b.length && a.every((id, index) => id === b[index])
}

function safeId(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "-")
}

function moveItem(order: string[], from: number, to: number) {
  if (from === to) return order.slice()
  const next = order.slice()
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}

function liquidTabPath(tabLeft: number, surfaceWidth: number, tabWidth: number) {
  const panelLeft = SURFACE_INSET
  const panelRight = surfaceWidth - SURFACE_INSET
  const left = Math.max(panelLeft, Math.min(panelRight - tabWidth, tabLeft))
  const right = left + tabWidth
  const top = RAIL_HEIGHT - TAB_HEIGHT
  const bottom = RAIL_HEIGHT
  const leftJoin = Math.max(panelLeft, left - LIQUID_JOIN)
  const rightJoin = Math.min(panelRight, right + LIQUID_JOIN)
  const leftDepth = Math.min(LIQUID_JOIN, left - leftJoin)
  const rightDepth = Math.min(LIQUID_JOIN, rightJoin - right)
  const leftControl = leftDepth * 0.55
  const rightControl = rightDepth * 0.55
  const leftPanelRadius = Math.min(PANEL_RADIUS, leftJoin - panelLeft)
  const rightPanelRadius = Math.min(PANEL_RADIUS, panelRight - rightJoin)

  return [
    `M${panelLeft} ${bottom + PANEL_RADIUS}`,
    `V${bottom + leftPanelRadius}`,
    `Q${panelLeft} ${bottom} ${panelLeft + leftPanelRadius} ${bottom}`,
    `H${leftJoin}`,
    `C${leftJoin + leftControl} ${bottom} ${left} ${bottom - leftDepth + leftControl} ${left} ${bottom - leftDepth}`,
    `V${top + TAB_RADIUS}`,
    `Q${left} ${top} ${left + TAB_RADIUS} ${top}`,
    `H${right - TAB_RADIUS}`,
    `Q${right} ${top} ${right} ${top + TAB_RADIUS}`,
    `V${bottom - rightDepth}`,
    `C${right} ${bottom - rightDepth + rightControl} ${rightJoin - rightControl} ${bottom} ${rightJoin} ${bottom}`,
    `H${panelRight - rightPanelRadius}`,
    `Q${panelRight} ${bottom} ${panelRight} ${bottom + rightPanelRadius}`,
    `V${bottom + PANEL_RADIUS}`,
    "Z",
  ].join(" ")
}

function SpringTab({
  id,
  targetLeft,
  dragging,
  dragLeft,
  surfaceLeft,
  reduce,
  active,
  anyDragging,
  surfaceHost,
  surfaceWidth,
  tabWidth,
  surfaceClassName,
  zIndex,
  className,
  children,
  registerPosition,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  onLostPointerCapture,
}: SpringTabProps) {
  const target = useMotionValue(targetLeft)
  const position = useSpring(target, SPRING_GLIDE)
  const settledTransform = useTransform(
    reduce ? target : position,
    left => `translate3d(${left}px, 0, 0)`
  )
  const draggedTransform = useTransform(dragLeft, left => `translate3d(${left}px, 0, 0)`)

  useLayoutEffect(() => {
    target.set(targetLeft)
    if (reduce) position.jump(targetLeft)
  }, [position, reduce, target, targetLeft])

  useLayoutEffect(() => {
    registerPosition(id, position)
    return () => registerPosition(id, null)
  }, [id, position, registerPosition])

  const liquidDriver = anyDragging ? (dragging ? dragLeft : position) : surfaceLeft

  return (
    <>
      {active && surfaceHost && surfaceWidth > SURFACE_INSET * 2
        ? createPortal(
            <svg
              aria-hidden="true"
              focusable="false"
              viewBox={`0 0 ${surfaceWidth} ${RAIL_HEIGHT + PANEL_RADIUS}`}
              preserveAspectRatio="none"
              className={cn(
                "pointer-events-none absolute inset-x-0 top-0 w-full text-background",
                dragging ? "z-20" : "z-0",
                surfaceClassName
              )}
              style={{ height: RAIL_HEIGHT + PANEL_RADIUS }}
            >
              <defs>
                {/* 面板从上到下渐变: tab 顶端 (RAIL_HEIGHT - TAB_HEIGHT ~ TAB_TOP) fully opaque,
                    过 RAIL_HEIGHT (面板底沿) 之后逐渐透明, 让下面画布颜色自然透过. */}
                <linearGradient id={`liquid-fade-${id}`} x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="currentColor" stopOpacity="1" />
                  <stop
                    offset={`${((RAIL_HEIGHT - TAB_HEIGHT / 2) / (RAIL_HEIGHT + PANEL_RADIUS)) * 100}%`}
                    stopColor="currentColor"
                    stopOpacity="1"
                  />
                  <stop
                    offset={`${(RAIL_HEIGHT / (RAIL_HEIGHT + PANEL_RADIUS)) * 100}%`}
                    stopColor="currentColor"
                    stopOpacity="0.85"
                  />
                  <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
                </linearGradient>
              </defs>
              <LiquidSurfacePath
                key={anyDragging ? (dragging ? "dragged" : "displaced") : "idle"}
                fillId={`liquid-fade-${id}`}
                left={liquidDriver}
                surfaceWidth={surfaceWidth}
                tabWidth={tabWidth}
              />
            </svg>,
            surfaceHost
          )
        : null}
      <motion.div
        style={{
          zIndex,
          transform: dragging ? draggedTransform : settledTransform,
        }}
        className={className}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onLostPointerCapture={onLostPointerCapture}
      >
        {children}
      </motion.div>
    </>
  )
}
function LiquidSurfacePath({
  left,
  surfaceWidth,
  tabWidth,
  fillId,
}: {
  left: MotionValue<number>
  surfaceWidth: number
  tabWidth: number
  fillId?: string
}) {
  const path = useTransform(left, value => liquidTabPath(value, surfaceWidth, tabWidth))
  return <motion.path d={path} fill={fillId ? `url(#${fillId})` : "currentColor"} />
}

export function MorphingTabs({
  items,
  value,
  defaultValue,
  onValueChange,
  onOrderChange,
  onClose,
  ariaLabel = "Tabs",
  className,
  classNames,
  startInset = 0,
  endInset = 0,
  trailing,
}: MorphingTabsProps) {
  const reduce = Boolean(useReducedMotion())
  const uid = useId()
  const itemIds = useMemo(() => items.map(item => item.id), [items])
  const itemMap = useMemo(() => new Map(items.map(item => [item.id, item])), [items])
  const [order, setOrder] = useState(itemIds)

  const [internalValue, setInternalValue] = useState<string | null>(
    defaultValue ?? itemIds[0] ?? null
  )
  const controlled = value !== undefined
  const currentValue = controlled ? (value ?? null) : internalValue

  const rootRef = useRef<HTMLDivElement | null>(null)
  const [surfaceHost, setSurfaceHost] = useState<HTMLDivElement | null>(null)
  const railRef = useRef<HTMLDivElement | null>(null)
  const tabButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({})
  const tabPositionRefs = useRef<Record<string, MotionValue<number> | null>>({})
  const dragRef = useRef<DragSession | null>(null)
  const dragAnimationRef = useRef<ReturnType<typeof animateValue> | null>(null)
  const surfaceAnimationRef = useRef<ReturnType<typeof animateValue> | null>(null)
  const [surfaceWidth, setSurfaceWidth] = useState(0)
  const [tabGap, setTabGap] = useState(12)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragTargetIndex, setDragTargetIndex] = useState(-1)
  const dragLeft = useMotionValue(SURFACE_INSET)
  const surfaceLeft = useMotionValue(SURFACE_INSET)

  const reconciledOrder = useMemo(() => {
    const available = new Set(itemIds)
    const retained = order.filter(id => available.has(id))
    const retainedSet = new Set(retained)
    return [...retained, ...itemIds.filter(id => !retainedSet.has(id))]
  }, [itemIds, order])
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setOrder(current => (sameOrder(current, reconciledOrder) ? current : reconciledOrder))
    })
    return () => cancelAnimationFrame(frame)
  }, [reconciledOrder])

  const orderedItems = useMemo(
    () =>
      reconciledOrder.flatMap(id => {
        const item = itemMap.get(id)
        return item ? [item] : []
      }),
    [itemMap, reconciledOrder]
  )

  const firstEnabledItem = orderedItems.find(item => !item.disabled) ?? orderedItems[0] ?? null
  const activeItem =
    currentValue && itemMap.has(currentValue)
      ? (itemMap.get(currentValue) ?? null)
      : firstEnabledItem
  const activeId = activeItem?.id ?? null

  // The rail cannot scroll: the liquid surface is one continuous shape spanning
  // the panel, so its notch has to stay over the tab that cut it. Slots narrow
  // to fit the panel instead, in that order of sacrifice:
  //   1. the design width, down to a floor where a truncated label still reads;
  //   2. the gap between slots, so the floor survives one panel narrower;
  //   3. the floor itself — a cramped tab is still tappable, a clipped one is
  //      not reachable at all.
  // Every tier fits inside the panel by construction, so no tab is ever cut off
  // and the notch never has to be clamped away from the tab that cut it.
  const { tabWidth, slotGap } = useMemo(() => {
    const count = reconciledOrder.length
    const pinnedCount = reconciledOrder.reduce(
      (acc, id) => acc + (itemMap.get(id)?.pinned ? 1 : 0),
      0
    )
    const nonPinnedCount = count - pinnedCount
    if (!surfaceWidth || nonPinnedCount === 0) {
      return { tabWidth: MAX_TAB_WIDTH, slotGap: tabGap }
    }
    const reservedPinned = pinnedCount * PINNED_TAB_WIDTH
    // 可用 tab 宽度 = surfaceWidth - 两侧 SURFACE_INSET - startInset (红绿灯让位)
    // - endInset ('+' 按钮让位) - pinned 保留.
    const inner = surfaceWidth - SURFACE_INSET * 2 - startInset - endInset - reservedPinned
    const widthAt = (gap: number) => Math.floor((inner - gap * (count - 1)) / nonPinnedCount)

    if (widthAt(tabGap) >= MIN_TAB_WIDTH) {
      return {
        tabWidth: Math.min(MAX_TAB_WIDTH, widthAt(tabGap)),
        slotGap: tabGap,
      }
    }
    if (count > 1 && widthAt(0) >= MIN_TAB_WIDTH) {
      const gap = Math.floor((inner - MIN_TAB_WIDTH * nonPinnedCount) / (count - 1))
      return { tabWidth: MIN_TAB_WIDTH, slotGap: Math.max(0, gap) }
    }
    return { tabWidth: Math.max(0, widthAt(0)), slotGap: 0 }
  }, [reconciledOrder, surfaceWidth, tabGap, itemMap, startInset, endInset])

  const widthOf = useCallback(
    (index: number) => (itemMap.get(reconciledOrder[index])?.pinned ? PINNED_TAB_WIDTH : tabWidth),
    [itemMap, reconciledOrder, tabWidth]
  )

  // slotLefts: prefix-sum, per-slot width. pinned 位置只占 PINNED_TAB_WIDTH.
  const slotLefts = useMemo(() => {
    const arr: number[] = []
    let cursor = SURFACE_INSET + startInset
    for (let i = 0; i < reconciledOrder.length; i += 1) {
      arr.push(cursor)
      cursor += widthOf(i) + slotGap
    }
    return arr
  }, [reconciledOrder, slotGap, widthOf, startInset])

  const dragStartIndex = draggingId ? reconciledOrder.indexOf(draggingId) : -1

  const visualIndexFor = useCallback(
    (index: number) => {
      if (dragStartIndex < 0 || dragTargetIndex < 0) return index
      if (index === dragStartIndex) return dragTargetIndex

      if (dragTargetIndex > dragStartIndex && index > dragStartIndex && index <= dragTargetIndex) {
        return index - 1
      }
      if (dragTargetIndex < dragStartIndex && index >= dragTargetIndex && index < dragStartIndex) {
        return index + 1
      }
      return index
    },
    [dragStartIndex, dragTargetIndex]
  )

  useLayoutEffect(() => {
    const root = rootRef.current
    const rail = railRef.current
    if (!root || !rail) return

    const measure = () => {
      setSurfaceWidth(root.clientWidth)
      const nextGap = Number.parseFloat(getComputedStyle(rail).columnGap)
      if (Number.isFinite(nextGap)) setTabGap(nextGap)
    }

    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(root)
    return () => observer.disconnect()
  }, [])

  const setActive = useCallback(
    (id: string | null) => {
      if (id && itemMap.get(id)?.disabled) return
      if (!controlled) setInternalValue(id)
      onValueChange?.(id)
    },
    [controlled, itemMap, onValueChange]
  )

  const activeOrderIndex = activeId ? reconciledOrder.indexOf(activeId) : -1
  const activeVisualIndex = activeOrderIndex < 0 ? -1 : visualIndexFor(activeOrderIndex)

  useLayoutEffect(() => {
    if (
      !activeId ||
      activeVisualIndex < 0 ||
      activeId === draggingId ||
      slotLefts[activeVisualIndex] === undefined
    ) {
      return
    }

    surfaceAnimationRef.current?.stop()

    if (draggingId) return

    surfaceAnimationRef.current = animateValue(
      surfaceLeft,
      slotLefts[activeVisualIndex],
      reduce ? { duration: 0 } : SPRING_GLIDE
    )
  }, [activeId, activeVisualIndex, draggingId, reduce, slotLefts, surfaceLeft])

  const commitOrder = useCallback(
    (next: string[], notify: boolean) => {
      setOrder(current => (sameOrder(current, next) ? current : next))
      if (notify) onOrderChange?.(next)
    },
    [onOrderChange]
  )

  const registerPosition = useCallback((id: string, position: MotionValue<number> | null) => {
    tabPositionRefs.current[id] = position
  }, [])

  const startDrag = useCallback(
    (id: string, event: ReactPointerEvent<HTMLDivElement>) => {
      if (
        event.button !== 0 ||
        itemMap.get(id)?.disabled ||
        itemMap.get(id)?.pinned ||
        dragRef.current
      ) {
        return
      }

      const startIndex = reconciledOrder.indexOf(id)
      if (startIndex < 0) return
      const capturedSlots: number[] = []
      {
        let cursor = SURFACE_INSET + startInset
        for (let i = 0; i < reconciledOrder.length; i += 1) {
          capturedSlots.push(cursor)
          cursor += widthOf(i) + slotGap
        }
      }
      const startLeft = capturedSlots[startIndex]

      dragAnimationRef.current?.stop()
      dragAnimationRef.current = null
      dragLeft.set(startLeft)
      dragRef.current = {
        id,
        pointerId: event.pointerId,
        originX: event.clientX,
        startLeft,
        startIndex,
        targetIndex: startIndex,
        moved: false,
        finishing: false,
        startOrder: reconciledOrder.slice(),
        slotLefts: capturedSlots,
      }
    },
    [dragLeft, itemMap, reconciledOrder, slotGap, startInset, widthOf]
  )

  const moveDrag = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current
      if (!drag || drag.finishing || drag.pointerId !== event.pointerId) return

      const delta = event.clientX - drag.originX
      if (!drag.moved && Math.abs(delta) < DRAG_THRESHOLD) return
      event.preventDefault()

      if (!drag.moved) {
        drag.moved = true
        capturePointer(event.currentTarget, event.pointerId)
        if (drag.id === activeId) {
          surfaceAnimationRef.current?.stop()
          surfaceLeft.set(drag.startLeft)
        }
        setDraggingId(drag.id)
        setDragTargetIndex(drag.startIndex)
      }

      const minLeft = drag.slotLefts[0]
      const maxLeft = drag.slotLefts[drag.slotLefts.length - 1]
      const visualLeft = Math.max(minLeft, Math.min(maxLeft, drag.startLeft + delta))
      let targetIndex = drag.startIndex

      if (visualLeft >= drag.startLeft) {
        for (let index = drag.startIndex + 1; index < drag.slotLefts.length; index += 1) {
          if (visualLeft + tabWidth / 2 >= drag.slotLefts[index]) {
            targetIndex = index
          }
        }
      } else {
        for (let index = drag.startIndex - 1; index >= 0; index -= 1) {
          if (visualLeft <= drag.slotLefts[index] + tabWidth / 2) {
            targetIndex = index
          }
        }
      }

      // [ZoeyMind] 保护 pinned items 位置: 不允许 drop 到 pinned 索引.
      const isPinnedAt = (i: number) => !!itemMap.get(drag.startOrder[i])?.pinned
      while (targetIndex !== drag.startIndex && isPinnedAt(targetIndex)) {
        targetIndex = targetIndex > drag.startIndex ? targetIndex - 1 : targetIndex + 1
      }
      dragLeft.set(visualLeft)
      if (targetIndex !== drag.targetIndex) {
        drag.targetIndex = targetIndex
        setDragTargetIndex(targetIndex)
      }
    },
    [activeId, dragLeft, surfaceLeft, tabWidth, itemMap]
  )

  const finishDrag = useCallback(
    (pointerId: number) => {
      const drag = dragRef.current
      if (!drag || drag.pointerId !== pointerId || drag.finishing) return

      if (!drag.moved) {
        dragRef.current = null
        return
      }

      drag.finishing = true
      const targetLeft = drag.slotLefts[drag.targetIndex]
      const controls = animateValue(dragLeft, targetLeft, reduce ? { duration: 0 } : SPRING_GLIDE)
      dragAnimationRef.current = controls

      controls.then(async () => {
        if (dragAnimationRef.current !== controls) return
        const next = moveItem(drag.startOrder, drag.startIndex, drag.targetIndex)

        if (!reduce) {
          await new Promise<void>(resolve => {
            const startedAt = performance.now()
            const check = () => {
              const settled = next.every((id, index) => {
                if (id === drag.id) return true
                const position = tabPositionRefs.current[id]
                if (!position) return true
                return (
                  Math.abs(position.get() - drag.slotLefts[index]) < 0.5 &&
                  Math.abs(position.getVelocity()) < 10
                )
              })

              if (settled || performance.now() - startedAt > 500) {
                resolve()
                return
              }
              requestAnimationFrame(check)
            }
            check()
          })
        }

        if (dragAnimationRef.current !== controls) return
        if (drag.id === activeId) {
          surfaceLeft.set(targetLeft)
        } else if (activeId) {
          const activePosition = tabPositionRefs.current[activeId]
          if (activePosition) surfaceLeft.set(activePosition.get())
        }
        tabPositionRefs.current[drag.id]?.jump(targetLeft)
        dragAnimationRef.current = null
        dragRef.current = null
        commitOrder(next, !sameOrder(drag.startOrder, next))
        setDraggingId(null)
        setDragTargetIndex(-1)
      })
    },
    [activeId, commitOrder, dragLeft, reduce, surfaceLeft]
  )

  useEffect(() => {
    const finishFromWindow = (event: PointerEvent) => {
      finishDrag(event.pointerId)
    }
    window.addEventListener("pointerup", finishFromWindow, true)
    window.addEventListener("pointercancel", finishFromWindow, true)
    return () => {
      window.removeEventListener("pointerup", finishFromWindow, true)
      window.removeEventListener("pointercancel", finishFromWindow, true)
    }
  }, [finishDrag])

  const moveBy = useCallback(
    (id: string, direction: -1 | 1) => {
      const current = reconciledOrder
      const index = current.indexOf(id)
      const nextIndex = index + direction
      if (index < 0 || nextIndex < 0 || nextIndex >= current.length || itemMap.get(id)?.disabled) {
        return
      }
      commitOrder(moveItem(current, index, nextIndex), true)
    },
    [commitOrder, itemMap, reconciledOrder]
  )

  const handleTabKeyDown = useCallback(
    (id: string, event: React.KeyboardEvent<HTMLButtonElement>) => {
      const index = reconciledOrder.indexOf(id)
      if (index < 0) return

      if (event.altKey && (event.key === "ArrowLeft" || event.key === "ArrowRight")) {
        event.preventDefault()
        moveBy(id, event.key === "ArrowLeft" ? -1 : 1)
        return
      }
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return

      event.preventDefault()
      const direction = event.key === "ArrowLeft" ? -1 : 1
      const nextIndex = (index + direction + reconciledOrder.length) % reconciledOrder.length
      const nextId = reconciledOrder[nextIndex]
      setActive(nextId)
      requestAnimationFrame(() => tabButtonRefs.current[nextId]?.focus())
    },
    [moveBy, reconciledOrder, setActive]
  )

  if (!orderedItems.length) return null

  return (
    <div
      ref={node => {
        rootRef.current = node
        setSurfaceHost(node)
      }}
      className={cn(
        "relative isolate min-w-0 overflow-visible bg-transparent text-foreground",
        classNames?.root,
        className
      )}
    >
      <div className="relative" style={{ height: RAIL_HEIGHT }}>
        <div
          ref={railRef}
          role="tablist"
          aria-label={ariaLabel}
          aria-orientation="horizontal"
          className={cn("relative z-30 flex h-full gap-0.5", classNames?.rail)}
        >
          {orderedItems.map((item, index) => {
            const isActive = item.id === activeId
            const isDragging = item.id === draggingId
            const visualIndex = visualIndexFor(index)
            const targetLeft = slotLefts[visualIndex] ?? SURFACE_INSET
            const tabId = `${uid}-tab-${safeId(item.id)}`

            return (
              <SpringTab
                key={item.id}
                id={item.id}
                targetLeft={targetLeft}
                dragging={isDragging}
                dragLeft={dragLeft}
                surfaceLeft={surfaceLeft}
                reduce={reduce}
                active={isActive}
                anyDragging={Boolean(draggingId)}
                surfaceHost={surfaceHost}
                surfaceWidth={surfaceWidth}
                tabWidth={widthOf(index)}
                surfaceClassName={classNames?.activeTab}
                zIndex={isDragging ? 30 : isActive ? 20 : 1}
                className={cn(
                  // The drag is ours end to end, so iPadOS must not answer the
                  // press with its callout or a native drag of the label.
                  "group absolute left-0 top-0 flex touch-pan-y items-stretch",
                  TOUCH_GESTURE_CLASS,
                  item.disabled && "cursor-not-allowed",
                  isDragging ? "cursor-grabbing" : "cursor-grab"
                )}
                registerPosition={registerPosition}
                onPointerDown={event => startDrag(item.id, event)}
                onPointerMove={moveDrag}
                onPointerUp={event => finishDrag(event.pointerId)}
                onPointerCancel={event => finishDrag(event.pointerId)}
                // A touch is implicitly captured by whatever it landed on —
                // here the label inside the tab — so the moment the drag takes
                // the capture for the tab itself, that child *loses* it, and
                // Ending the drag on it kills the gesture on the frame it
                // starts. Only the tab losing its own capture means the
                // platform took the pointer away. A mouse has no implicit
                // capture, which is why this only ever bit on a real finger.
                onLostPointerCapture={event => {
                  if (event.target !== event.currentTarget) return
                  finishDrag(event.pointerId)
                }}
              >
                <div
                  style={{
                    width: widthOf(index),
                    height: TAB_HEIGHT,
                    marginTop: TAB_TOP,
                  }}
                  className="relative flex items-stretch"
                >
                  {!isActive ? (
                    <span
                      aria-hidden
                      className={cn(
                        // [ZoeyMind] 缩到 bottom-1 让 hover pill 底部留 4px 缝,
                        // 不贴下面的 panel; 左右也各 2px 让开 tab 边.
                        "absolute inset-x-0.5 bottom-1 top-1 transition-colors duration-200",
                        item.pinned ? "rounded-full" : "rounded-md",
                        isDragging
                          ? "bg-foreground/15"
                          : "bg-transparent group-hover:bg-foreground/10"
                      )}
                    />
                  ) : null}

                  <button
                    ref={node => {
                      tabButtonRefs.current[item.id] = node
                    }}
                    id={tabId}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    aria-controls={`${uid}-panel`}
                    aria-disabled={item.disabled || undefined}
                    tabIndex={isActive ? 0 : -1}
                    disabled={item.disabled}
                    onClick={() => {
                      const drag = dragRef.current
                      if (drag?.id === item.id && drag.moved) return
                      setActive(item.id)
                    }}
                    onKeyDown={event => handleTabKeyDown(item.id, event)}
                    className={cn(
                      // [ZoeyMind] pinned 图标 tab 用 justify-center 让 icon 居中而非左靠 padding;
                      // 圆角对齐 TAB_RADIUS 常量, 避免和液态 SVG 曲线错位.
                      "group relative z-10 flex h-full w-full min-w-0 cursor-pointer items-center justify-center gap-1.5 overflow-hidden outline-none transition-colors",
                      item.pinned ? "rounded-full px-0" : onClose ? "pl-3 pr-7" : "px-3",
                      isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                      classNames?.tab
                    )}
                    style={
                      item.pinned
                        ? undefined
                        : { borderTopLeftRadius: TAB_RADIUS, borderTopRightRadius: TAB_RADIUS }
                    }
                  >
                    <span
                      aria-hidden
                      className={cn(
                        "pointer-events-none absolute inset-x-1 top-1 opacity-0 transition-opacity group-focus-visible:opacity-100",
                        isActive
                          ? "bottom-0 rounded-t-md border-x-2 border-t-2 border-foreground/20"
                          : "bottom-2 rounded border-2 border-foreground/60"
                      )}
                    />
                    {item.icon ? (
                      <span
                        aria-hidden
                        className={cn("grid size-4 shrink-0 place-items-center", classNames?.icon)}
                      >
                        {item.icon}
                      </span>
                    ) : null}
                    {item.label ? (
                      <span
                        className={cn(
                          "min-w-0 truncate whitespace-nowrap text-xs font-medium leading-none tracking-[-0.01em]",
                          classNames?.label
                        )}
                      >
                        {item.label}
                      </span>
                    ) : null}
                  </button>

                  {onClose && !item.pinned ? (
                    <div className="absolute right-1.5 top-1/2 z-20 -translate-y-1/2">
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        aria-label={`Close ${item.label}`}
                        onPointerDown={event => event.stopPropagation()}
                        onClick={event => {
                          event.stopPropagation()
                          onClose(item.id)
                        }}
                        className={cn(
                          "rounded-full text-muted-foreground hover:text-foreground",
                          classNames?.close
                        )}
                      >
                        <X aria-hidden />
                      </Button>
                    </div>
                  ) : null}
                </div>
              </SpringTab>
            )
          })}
          {trailing ? (
            <div
              aria-hidden={false}
              className="absolute z-30 flex items-center transition-[left] duration-200 ease-out"
              style={{
                left:
                  reconciledOrder.length > 0
                    ? (slotLefts[reconciledOrder.length - 1] ?? SURFACE_INSET) +
                      widthOf(reconciledOrder.length - 1) +
                      slotGap
                    : SURFACE_INSET + startInset,
                top: TAB_TOP,
                height: TAB_HEIGHT,
              }}
            >
              {trailing}
            </div>
          ) : null}
        </div>
      </div>

      <div
        id={`${uid}-panel`}
        role="tabpanel"
        aria-labelledby={`${uid}-tab-${safeId(activeId ?? "empty")}`}
        className={cn(
          "relative z-20 mx-4 min-h-64 overflow-hidden rounded-[1.75rem] bg-background text-foreground",
          classNames?.content
        )}
      >
        <AnimatePresence mode="popLayout" initial={false}>
          {activeItem ? (
            <motion.div
              key={activeItem.id}
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8, filter: "blur(6px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={
                reduce
                  ? {
                      opacity: 0,
                      transition: { duration: 0.08, ease: EASE_OUT },
                    }
                  : {
                      opacity: 0,
                      y: -5,
                      filter: "blur(5px)",
                      transition: { duration: 0.12, ease: EASE_OUT },
                    }
              }
              transition={reduce ? { duration: 0.12, ease: EASE_OUT } : SPRING_PRESS}
              className="min-h-64"
            >
              {activeItem.content}
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  )
}
