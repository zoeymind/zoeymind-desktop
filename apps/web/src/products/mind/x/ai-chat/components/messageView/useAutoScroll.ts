// @ts-nocheck — desktop mirror of cloud AI chat; runtime bridged via bridge.tsx
/**
 * useAutoScroll —— 基于 `use-stick-to-bottom` 的自动滚动 hook 适配层.
 *
 * 之前是自己撸的 wheel + scroll 事件 + userScrolled 状态机, 手感差且边界条件
 * 多 (spring 动画 / 内容变短 / mobile 惯性). 现在换成 stackblitz-labs 的
 * useStickToBottom, 由它接管:
 *   - 用户手动向上滚 -> 自动脱离 stick
 *   - 滚回底部 -> 自动恢复 stick
 *   - 流式内容不断增高时用 velocity-based spring 平滑追底
 *
 * 对外 API 与旧版兼容:
 *   containerRef  -> 外层滚动容器的 ref (对应库的 scrollRef)
 *   messagesEndRef-> 保留但不再必要, 兼容旧模板里 <div ref={messagesEndRef} />
 *
 * 新增:
 *   contentRef    -> 内层内容盒子的 ref (库需要挂 ResizeObserver)
 *   isAtBottom    -> 是否贴底
 *   scrollToBottom-> 命令式滚到底部
 */

import { useCallback, useEffect, useRef } from "react"
import { animate, type AnimationPlaybackControls } from "motion"
import { useStickToBottom } from "use-stick-to-bottom"
import type { UIMessage } from "@ai-sdk/react"
import { isTrackpadWheelStream } from "@/products/mind/features/mindmap/components/hooks/interactionMotion"

interface UseAutoScrollProps {
  messages: UIMessage[]
  isSending?: boolean
  onScrollStatusChange?: (isNearBottom: boolean) => void
}

export function useAutoScroll({
  messages,
  isSending: _isSending,
  onScrollStatusChange,
}: UseAutoScrollProps) {
  // initial: 'auto' -> 首次挂载直接跳底 (无动画, 打开对话不闪);
  // resize: 'smooth' -> 流式增高时 spring 追底.
  const { scrollRef, contentRef, isAtBottom, scrollToBottom, stopScroll } = useStickToBottom({
    initial: "auto",
    resize: "smooth",
  })

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const wheelAnimationRef = useRef<AnimationPlaybackControls | null>(null)
  const wheelTargetRef = useRef(0)
  const lastWheelTimeRef = useRef(0)

  useEffect(() => {
    const container = scrollRef.current
    if (!container) return

    wheelTargetRef.current = container.scrollTop
    const handleWheel = (event: WheelEvent) => {
      if (event.ctrlKey || event.metaKey) return
      const delta = event.deltaMode === WheelEvent.DOM_DELTA_LINE ? event.deltaY * 16 : event.deltaY
      if (delta === 0) return

      const now = performance.now()
      const elapsed = now - lastWheelTimeRef.current
      lastWheelTimeRef.current = now
      if (isTrackpadWheelStream(delta, elapsed)) {
        wheelAnimationRef.current?.stop()
        wheelAnimationRef.current = null
        wheelTargetRef.current = container.scrollTop
        return
      }
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return

      const maxScrollTop = Math.max(0, container.scrollHeight - container.clientHeight)
      const step = Math.abs(delta) < 40 ? Math.sign(delta) * 40 : delta
      const nextTarget = Math.min(maxScrollTop, Math.max(0, wheelTargetRef.current + step))
      if (nextTarget === container.scrollTop && nextTarget === wheelTargetRef.current) return

      event.preventDefault()
      stopScroll()
      wheelAnimationRef.current?.stop()
      wheelTargetRef.current = nextTarget
      wheelAnimationRef.current = animate(container.scrollTop, nextTarget, {
        type: "spring",
        stiffness: 280,
        damping: 34,
        mass: 0.7,
        restDelta: 0.5,
        restSpeed: 8,
        onUpdate: value => {
          container.scrollTop = value
        },
        onComplete: () => {
          wheelAnimationRef.current = null
          wheelTargetRef.current = container.scrollTop
        },
      })
    }
    const syncTarget = () => {
      if (!wheelAnimationRef.current) wheelTargetRef.current = container.scrollTop
    }
    const interruptWheelAnimation = () => {
      wheelAnimationRef.current?.stop()
      wheelAnimationRef.current = null
      wheelTargetRef.current = container.scrollTop
    }

    container.addEventListener("wheel", handleWheel, { passive: false })
    container.addEventListener("pointerdown", interruptWheelAnimation, { passive: true })
    container.addEventListener("scroll", syncTarget, { passive: true })
    return () => {
      wheelAnimationRef.current?.stop()
      wheelAnimationRef.current = null
      container.removeEventListener("wheel", handleWheel)
      container.removeEventListener("pointerdown", interruptWheelAnimation)
      container.removeEventListener("scroll", syncTarget)
    }
  }, [scrollRef, stopScroll])

  // 状态回传给面板容器 (显示"回到底部"按钮).
  useEffect(() => {
    onScrollStatusChange?.(isAtBottom)
  }, [isAtBottom, onScrollStatusChange])

  // 新消息到来时如果当前在底部, 库会自动追加; 但对 messages.length 变化
  // 主动 nudge 一次, 避免边缘情况下 ResizeObserver 未及时触发.
  useEffect(() => {
    if (isAtBottom) void scrollToBottom("smooth")
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length])

  // 兼容旧 API: 消费方拿到的 scrollToBottom 无参; 内部转发给库.
  const scrollToBottomCompat = useCallback(() => {
    void scrollToBottom("smooth")
  }, [scrollToBottom])

  return {
    containerRef: scrollRef,
    contentRef,
    messagesEndRef,
    isAtBottom,
    scrollToBottom: scrollToBottomCompat,
  }
}
