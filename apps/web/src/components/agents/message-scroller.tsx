"use client"
// beui.dev/components/agents/message-scroller

import { useReducedMotion } from "motion/react"
import {
  type ComponentPropsWithRef,
  type Ref,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
} from "react"
import { PreviewRail, type PreviewRailItem } from "@/components/motion/preview-rail"
import { cn } from "@/lib/utils"

const PREVIEW_TITLE_LENGTH = 56
const PREVIEW_DESCRIPTION_LENGTH = 88
const WHEEL_DECAY_TIME_MS = 420
const MIN_WHEEL_SPEED = 12
const WHEEL_VELOCITY_FACTOR = 5.5

function isTrackpadWheelStream(delta: number, elapsedMs: number) {
  return elapsedMs < 30 && Math.abs(delta) < 24
}

function decayWheelVelocity(velocity: number, elapsedMs: number) {
  return velocity * Math.exp(-elapsedMs / WHEEL_DECAY_TIME_MS)
}

function nestedScrollerCanConsume(
  target: EventTarget | null,
  viewport: HTMLElement,
  delta: number
) {
  let element = target instanceof HTMLElement ? target : null
  while (element && element !== viewport) {
    const style = window.getComputedStyle(element)
    const scrollable =
      (style.overflowY === "auto" || style.overflowY === "scroll") &&
      element.scrollHeight > element.clientHeight
    if (scrollable) {
      const maxScrollTop = element.scrollHeight - element.clientHeight
      if ((delta < 0 && element.scrollTop > 0) || (delta > 0 && element.scrollTop < maxScrollTop)) {
        return true
      }
    }
    element = element.parentElement
  }
  return false
}

function truncateMessageText(text: string, limit: number) {
  if (text.length <= limit) return text
  const excerpt = text.slice(0, limit)
  const boundary = excerpt.lastIndexOf(" ")
  return `${excerpt.slice(0, boundary > limit * 0.65 ? boundary : limit).trim()}…`
}

function getMessageText(message: HTMLElement) {
  const surface =
    message.querySelector<HTMLElement>('[data-slot="message-bubble-content"]') ??
    message.querySelector<HTMLElement>('[data-slot="message-content"]') ??
    message
  return (surface.textContent ?? "").replace(/\s+/g, " ").trim()
}

function getMessagePreview(message: HTMLElement, assistantResponse?: HTMLElement) {
  const text = getMessageText(message)
  if (!text) {
    return { label: "Message", description: undefined }
  }

  if (text.length <= PREVIEW_TITLE_LENGTH) {
    const responseText = assistantResponse ? getMessageText(assistantResponse) : ""
    return {
      label: text,
      description: responseText
        ? truncateMessageText(responseText, PREVIEW_DESCRIPTION_LENGTH)
        : undefined,
    }
  }

  const titleExcerpt = text.slice(0, PREVIEW_TITLE_LENGTH)
  const titleBoundary = titleExcerpt.lastIndexOf(" ")
  const titleEnd =
    titleBoundary > PREVIEW_TITLE_LENGTH * 0.65 ? titleBoundary : PREVIEW_TITLE_LENGTH
  const label = `${text.slice(0, titleEnd).trim()}…`
  const responseText = assistantResponse
    ? getMessageText(assistantResponse)
    : text.slice(titleEnd).trim()
  return {
    label,
    description: responseText
      ? truncateMessageText(responseText, PREVIEW_DESCRIPTION_LENGTH)
      : undefined,
  }
}

export interface MessageScrollerProps extends ComponentPropsWithRef<"div"> {
  /** Keep streamed output pinned while the reader remains near the end. */
  followOutput?: boolean
  /** Distance from the end that still counts as following the output. */
  followThreshold?: number
  /** Smoothly follow growing content. */
  smooth?: boolean
  /** Reports when the reader leaves or returns to the live edge. */
  onFollowChange?: (following: boolean) => void
  /** Accessible label for the scrollable transcript. */
  label?: string
  /** Marks the transcript as waiting for more streamed content. */
  busy?: boolean
  /** Adds a compact rail for navigating between rendered Message rows. */
  navigation?: "rail"
  /** Accessible label for the optional message navigation rail. */
  navigationLabel?: string
  viewportClassName?: string
  contentClassName?: string
  railClassName?: string
  viewportRef?: Ref<HTMLElement>
  viewportProps?: Omit<ComponentPropsWithRef<"section">, "children" | "className" | "ref">
  contentProps?: Omit<ComponentPropsWithRef<"div">, "children" | "className" | "ref">
}

export function MessageScroller({
  followOutput = true,
  followThreshold = 56,
  smooth = true,
  onFollowChange,
  label = "Conversation",
  busy,
  navigation,
  navigationLabel = "Message navigation",
  viewportClassName,
  contentClassName,
  railClassName,
  viewportRef: externalViewportRef,
  viewportProps,
  contentProps,
  className,
  children,
  ...props
}: MessageScrollerProps) {
  const reduce = useReducedMotion() ?? false
  const viewportRef = useRef<HTMLElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const followingRef = useRef(followOutput)
  const busyRef = useRef(busy ?? false)
  const programmaticScrollRef = useRef(false)
  const scrollTimerRef = useRef<number | undefined>(undefined)
  const frameRef = useRef<number | undefined>(undefined)
  const railFrameRef = useRef<number | undefined>(undefined)
  const kineticFrameRef = useRef<number | undefined>(undefined)
  const lastWheelTimeRef = useRef<number | null>(null)
  const wheelVelocityRef = useRef(0)
  const railIdRef = useRef(new WeakMap<HTMLElement, string>())
  const railIdCounterRef = useRef(0)
  const railTargetsRef = useRef(new Map<string, HTMLElement>())
  const [railItems, setRailItems] = useState<PreviewRailItem[]>([])
  const [activeRailId, setActiveRailId] = useState("")
  const [railOverflowing, setRailOverflowing] = useState(false)
  const {
    onScroll: onViewportScroll,
    onWheel: onViewportWheel,
    onTouchStart: onViewportTouchStart,
    onKeyDown: onViewportKeyDown,
    ...restViewportProps
  } = viewportProps ?? {}

  useImperativeHandle(externalViewportRef, () => viewportRef.current as HTMLElement)

  const setFollowing = useCallback(
    (next: boolean) => {
      if (followingRef.current === next) return
      followingRef.current = next
      onFollowChange?.(next)
    },
    [onFollowChange]
  )

  const updateActiveRailItem = useCallback(() => {
    if (navigation !== "rail") return
    const viewport = viewportRef.current
    const targets = [...railTargetsRef.current.entries()]
    if (!viewport || targets.length === 0) return

    const viewportRect = viewport.getBoundingClientRect()
    if (viewport.scrollTop <= followThreshold) {
      const firstId = targets[0]?.[0] ?? ""
      setActiveRailId(current => (current === firstId ? current : firstId))
      return
    }

    const distanceFromEnd = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight
    if (distanceFromEnd <= followThreshold) {
      const lastId = targets.at(-1)?.[0] ?? ""
      setActiveRailId(current => (current === lastId ? current : lastId))
      return
    }

    const viewportCenter = viewportRect.top + viewportRect.height / 2
    let nearestId = targets[0]?.[0] ?? ""
    let nearestDistance = Number.POSITIVE_INFINITY

    for (const [id, element] of targets) {
      const rect = element.getBoundingClientRect()
      const messageCenter = rect.top + rect.height / 2
      const distance = Math.abs(messageCenter - viewportCenter)
      if (distance < nearestDistance) {
        nearestDistance = distance
        nearestId = id
      }
    }

    setActiveRailId(current => (current === nearestId ? current : nearestId))
  }, [followThreshold, navigation])

  const syncRailItems = useCallback(() => {
    if (navigation !== "rail") return
    const content = contentRef.current
    const viewport = viewportRef.current
    if (!content || !viewport) return

    const messages = Array.from(content.querySelectorAll<HTMLElement>('[data-slot="message"]'))
    const targets = new Map<string, HTMLElement>()
    const nextItems = messages.map((message, index) => {
      let id = railIdRef.current.get(message)
      if (!id) {
        railIdCounterRef.current += 1
        id = `message-rail-${railIdCounterRef.current}`
        railIdRef.current.set(message, id)
      }
      targets.set(id, message)
      const sender = message.dataset.from ?? "conversation"
      const assistantResponse =
        sender === "user"
          ? messages.slice(index + 1).find(candidate => candidate.dataset.from === "assistant")
          : undefined
      const preview = getMessagePreview(message, assistantResponse)

      return {
        id,
        label: preview.label,
        description: preview.description,
        ariaLabel: `Go to ${sender} message ${index + 1} of ${messages.length}`,
      }
    })

    railTargetsRef.current = targets
    setRailItems(current => {
      const unchanged =
        current.length === nextItems.length &&
        current.every(
          (item, index) =>
            item.id === nextItems[index]?.id &&
            item.label === nextItems[index]?.label &&
            item.description === nextItems[index]?.description &&
            item.ariaLabel === nextItems[index]?.ariaLabel
        )
      return unchanged ? current : nextItems
    })
    setRailOverflowing(viewport.scrollHeight > viewport.clientHeight + 1 && messages.length > 1)
  }, [navigation])

  const pendingRailSyncRef = useRef(false)
  const scheduleRailSync = useCallback(() => {
    if (navigation !== "rail") return
    // 流式期间内容每 tick 都变: 每次 rail 同步都要 querySelectorAll + 读全量
    // textContent (强制布局), 且 setRailItems/setActiveRailId 在 observer 回调里
    // 同步触发 React 更新. 忙时挂起, 流结束后补一次.
    if (busyRef.current) {
      pendingRailSyncRef.current = true
      return
    }
    pendingRailSyncRef.current = false
    if (railFrameRef.current) cancelAnimationFrame(railFrameRef.current)
    railFrameRef.current = requestAnimationFrame(() => {
      syncRailItems()
      updateActiveRailItem()
    })
  }, [navigation, syncRailItems, updateActiveRailItem])
  useEffect(() => {
    busyRef.current = busy ?? false
    if (!busy && pendingRailSyncRef.current) scheduleRailSync()
  }, [busy, scheduleRailSync])

  const scrollToEnd = useCallback((behavior: ScrollBehavior) => {
    const viewport = viewportRef.current
    if (!viewport) return

    programmaticScrollRef.current = true
    if (typeof viewport.scrollTo === "function") {
      viewport.scrollTo({ top: viewport.scrollHeight, behavior })
    } else {
      viewport.scrollTop = viewport.scrollHeight
    }
    if (scrollTimerRef.current) window.clearTimeout(scrollTimerRef.current)
    scrollTimerRef.current = window.setTimeout(
      () => {
        programmaticScrollRef.current = false
      },
      behavior === "smooth" ? 320 : 0
    )
  }, [])

  const handleScroll = useCallback(() => {
    const viewport = viewportRef.current
    if (!viewport || programmaticScrollRef.current) return

    const distance = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight
    setFollowing(distance <= followThreshold)
    updateActiveRailItem()
  }, [followThreshold, setFollowing, updateActiveRailItem])

  const leaveLiveEdge = useCallback(() => {
    programmaticScrollRef.current = false
  }, [])

  const stopKineticScroll = useCallback(() => {
    if (kineticFrameRef.current) cancelAnimationFrame(kineticFrameRef.current)
    kineticFrameRef.current = undefined
    wheelVelocityRef.current = 0
  }, [])

  const startKineticScroll = useCallback(
    (initialVelocity: number) => {
      if (kineticFrameRef.current) cancelAnimationFrame(kineticFrameRef.current)
      const viewport = viewportRef.current
      if (!viewport || reduce || Math.abs(initialVelocity) < MIN_WHEEL_SPEED) return

      let velocity = initialVelocity
      let previousTime = performance.now()
      const advance = (time: number) => {
        const elapsed = Math.min(32, Math.max(1, time - previousTime))
        previousTime = time
        const nextVelocity = decayWheelVelocity(velocity, elapsed)
        const displacement = ((velocity + nextVelocity) / 2) * (elapsed / 1_000)
        velocity = nextVelocity
        wheelVelocityRef.current = velocity

        const maxScrollTop = Math.max(0, viewport.scrollHeight - viewport.clientHeight)
        const requested = viewport.scrollTop + displacement
        const next = Math.max(0, Math.min(maxScrollTop, requested))
        viewport.scrollTop = next
        if (next === requested && Math.abs(velocity) >= MIN_WHEEL_SPEED) {
          kineticFrameRef.current = requestAnimationFrame(advance)
        } else {
          kineticFrameRef.current = undefined
          wheelVelocityRef.current = 0
        }
      }
      kineticFrameRef.current = requestAnimationFrame(advance)
    },
    [reduce]
  )

  const handleKineticWheel = useCallback(
    (event: WheelEvent) => {
      const viewport = viewportRef.current
      if (!viewport) return
      const modeScale = event.deltaMode === WheelEvent.DOM_DELTA_LINE ? 16 : 1
      const delta = event.deltaY * modeScale
      if (delta === 0 || reduce || nestedScrollerCanConsume(event.target, viewport, delta)) return

      leaveLiveEdge()
      const previousWheelTime = lastWheelTimeRef.current
      const now = performance.now()
      const elapsed =
        previousWheelTime === null ? Number.POSITIVE_INFINITY : now - previousWheelTime
      lastWheelTimeRef.current = now
      if (
        (previousWheelTime === null && Math.abs(delta) < 24) ||
        isTrackpadWheelStream(delta, elapsed)
      ) {
        stopKineticScroll()
        return
      }

      event.preventDefault()
      const normalizedDelta = Math.abs(delta) < 40 ? Math.sign(delta) * 40 : delta
      const velocity = wheelVelocityRef.current * 0.45 + normalizedDelta * WHEEL_VELOCITY_FACTOR
      startKineticScroll(velocity)
    },
    [leaveLiveEdge, reduce, startKineticScroll, stopKineticScroll]
  )

  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return
    viewport.addEventListener("wheel", handleKineticWheel, { passive: false })
    return () => viewport.removeEventListener("wheel", handleKineticWheel)
  }, [handleKineticWheel])

  useLayoutEffect(() => {
    followingRef.current = followOutput
    if (!followOutput) return

    frameRef.current = requestAnimationFrame(() => scrollToEnd("auto"))
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current)
    }
  }, [followOutput, scrollToEnd])

  useEffect(() => {
    const content = contentRef.current
    if (!content || typeof ResizeObserver === "undefined") return

    const observer = new ResizeObserver(() => {
      scheduleRailSync()
      if (!followOutput || !followingRef.current) return
      // 流式输出期间内容每帧增长, smooth 滚动动画不断被重启, 造成连续合成层滚动;
      // busy 时直接贴底, 只有静态内容变化才用平滑滚动.
      scrollToEnd(reduce || !smooth || busyRef.current ? "auto" : "smooth")
    })
    observer.observe(content)

    return () => observer.disconnect()
  }, [followOutput, reduce, scheduleRailSync, scrollToEnd, smooth])

  useEffect(() => {
    if (navigation !== "rail") {
      railTargetsRef.current.clear()
      return
    }

    const content = contentRef.current
    const viewport = viewportRef.current
    if (!content || !viewport) return

    scheduleRailSync()
    const mutationObserver =
      typeof MutationObserver === "undefined" ? null : new MutationObserver(scheduleRailSync)
    mutationObserver?.observe(content, {
      childList: true,
      characterData: true,
      subtree: true,
    })

    const resizeObserver =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(scheduleRailSync)
    resizeObserver?.observe(content)
    resizeObserver?.observe(viewport)

    return () => {
      mutationObserver?.disconnect()
      resizeObserver?.disconnect()
    }
  }, [navigation, scheduleRailSync])

  useEffect(
    () => () => {
      if (scrollTimerRef.current) window.clearTimeout(scrollTimerRef.current)
      if (frameRef.current) cancelAnimationFrame(frameRef.current)
      if (railFrameRef.current) cancelAnimationFrame(railFrameRef.current)
      if (kineticFrameRef.current) cancelAnimationFrame(kineticFrameRef.current)
    },
    []
  )

  const scrollToRailItem = useCallback(
    (item: PreviewRailItem) => {
      const viewport = viewportRef.current
      const target = railTargetsRef.current.get(item.id)
      if (!viewport || !target) return

      const lastItem = railItems.at(-1)?.id === item.id
      setActiveRailId(item.id)
      if (lastItem) {
        setFollowing(true)
        scrollToEnd(reduce || !smooth ? "auto" : "smooth")
        return
      }

      setFollowing(false)
      programmaticScrollRef.current = true
      const viewportRect = viewport.getBoundingClientRect()
      const targetRect = target.getBoundingClientRect()
      const top =
        viewport.scrollTop +
        targetRect.top -
        viewportRect.top -
        (viewport.clientHeight - targetRect.height) / 2
      const behavior = reduce || !smooth ? "auto" : "smooth"

      if (typeof viewport.scrollTo === "function") {
        viewport.scrollTo({ top, behavior })
      } else {
        viewport.scrollTop = top
      }
      if (scrollTimerRef.current) window.clearTimeout(scrollTimerRef.current)
      scrollTimerRef.current = window.setTimeout(
        () => {
          programmaticScrollRef.current = false
        },
        behavior === "smooth" ? 320 : 0
      )
    },
    [railItems, reduce, scrollToEnd, setFollowing, smooth]
  )

  const viewport = (
    <section
      ref={viewportRef}
      aria-label={label}
      {...restViewportProps}
      onScroll={event => {
        handleScroll()
        onViewportScroll?.(event)
      }}
      onWheel={onViewportWheel}
      onTouchStart={event => {
        leaveLiveEdge()
        onViewportTouchStart?.(event)
      }}
      onKeyDown={event => {
        if (["ArrowUp", "PageUp", "Home"].includes(event.key)) {
          leaveLiveEdge()
        }
        onViewportKeyDown?.(event)
      }}
      className={cn(
        "h-full overflow-y-auto overscroll-contain outline-none [overflow-anchor:none] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
        navigation === "rail"
          ? "[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          : "[scrollbar-gutter:stable]",
        viewportClassName
      )}
    >
      <div
        ref={contentRef}
        role="log"
        aria-live="polite"
        aria-relevant="additions text"
        aria-busy={busy}
        className={contentClassName}
        {...contentProps}
      >
        {children}
      </div>
    </section>
  )

  return (
    <div data-slot="message-scroller" className={cn("min-h-0", className)} {...props}>
      {navigation === "rail" ? (
        <PreviewRail
          items={railOverflowing ? railItems : []}
          label={navigationLabel}
          activeId={activeRailId}
          onItemSelect={scrollToRailItem}
          previewSide="before"
          highlightActive
          itemSize={14}
          className="h-full min-h-0 overflow-hidden"
          previewContainerClassName="right-8 left-3"
          previewClassName="mr-1 w-64 max-w-full [&_[data-slot=preview-rail-card]]:h-20 [&_[data-slot=preview-rail-card]]:overflow-hidden [&_[data-slot=preview-rail-card]]:p-3 [&_[data-slot=preview-rail-title]]:line-clamp-1 [&_[data-slot=preview-rail-title]]:text-xs [&_[data-slot=preview-rail-title]]:leading-4 [&_[data-slot=preview-rail-description]]:line-clamp-2 [&_[data-slot=preview-rail-description]]:text-xs [&_[data-slot=preview-rail-description]]:leading-4"
          railClassName={cn(
            "absolute inset-y-3 right-1 w-7 content-center py-1 [&_[data-slot=preview-rail-item]]:w-7 [&_[data-slot=preview-rail-item]]:justify-end [&_[data-slot=preview-rail-tick]]:h-px [&_[data-slot=preview-rail-tick]]:w-4 [&_[data-slot=preview-rail-tick]]:origin-right",
            railOverflowing ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0",
            railClassName
          )}
        >
          {viewport}
        </PreviewRail>
      ) : (
        viewport
      )}
    </div>
  )
}
