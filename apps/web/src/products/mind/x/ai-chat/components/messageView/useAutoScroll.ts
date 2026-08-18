/**
 * useAutoScroll - 自动滚动 Hook
 *
 * 参考 opencode 的 createAutoScroll 实现：
 * - userScrolled 是持久状态：用户手动向上滚动后锁定，不再自动滚动
 * - 用户滚回底部时自动恢复跟随
 * - 用 markAuto/isAuto 区分"程序滚动"和"用户滚动"，避免误判
 */

import { useCallback, useRef, useState, useEffect } from 'react'
import type { UIMessage } from '@ai-sdk/react'

const BOTTOM_THRESHOLD = 10

interface UseAutoScrollProps {
  messages: UIMessage[]
  isSending?: boolean
  onScrollStatusChange?: (isNearBottom: boolean) => void
}

export function useAutoScroll({ messages, isSending, onScrollStatusChange }: UseAutoScrollProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // 持久状态：用户手动滚离底部后为 true，滚回底部后重置
  const [userScrolled, setUserScrolled] = useState(false)

  // 标记程序触发的滚动，避免 scroll 事件误判为用户操作
  const autoScrollRef = useRef<{ top: number; time: number } | null>(null)
  const autoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const markAuto = useCallback((el: HTMLElement) => {
    autoScrollRef.current = {
      top: Math.max(0, el.scrollHeight - el.clientHeight),
      time: Date.now()
    }
    if (autoTimerRef.current) clearTimeout(autoTimerRef.current)
    autoTimerRef.current = setTimeout(() => {
      autoScrollRef.current = null
      autoTimerRef.current = null
    }, 250)
  }, [])

  const isAutoScroll = useCallback((el: HTMLElement) => {
    const a = autoScrollRef.current
    if (!a) return false
    if (Date.now() - a.time > 250) {
      autoScrollRef.current = null
      return false
    }
    return Math.abs(el.scrollTop - a.top) < 2
  }, [])

  const distanceFromBottom = useCallback((el: HTMLElement) => {
    return el.scrollHeight - el.clientHeight - el.scrollTop
  }, [])

  const scrollToBottom = useCallback(
    (behavior: ScrollBehavior = 'auto') => {
      const el = containerRef.current
      if (!el) return
      markAuto(el)
      el.scrollTo({ top: el.scrollHeight, behavior })
    },
    [markAuto]
  )

  // 监听 wheel 事件：用户向上滚动 → 锁定 userScrolled
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const handleWheel = (e: WheelEvent) => {
      if (e.deltaY >= 0) return // 只关心向上滚动

      // 如果在嵌套可滚动区域内（如工具输出），不触发
      const target = e.target instanceof Element ? e.target : undefined
      const nested = target?.closest('[data-scrollable]')
      if (nested && nested !== container) return

      // 确认容器可滚动
      if (container.scrollHeight - container.clientHeight <= 1) return

      if (!userScrolled) {
        setUserScrolled(true)
      }
    }

    container.addEventListener('wheel', handleWheel, { passive: true })
    return () => container.removeEventListener('wheel', handleWheel)
  }, [userScrolled])

  // 监听 scroll 事件：滚回底部 → 重置 userScrolled
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const handleScroll = () => {
      const dist = distanceFromBottom(container)
      const isNearBottom = dist <= BOTTOM_THRESHOLD

      // 通知父组件滚动位置
      onScrollStatusChange?.(isNearBottom)

      // 内容不可滚动时重置
      if (container.scrollHeight - container.clientHeight <= 1) {
        if (userScrolled) setUserScrolled(false)
        return
      }

      // 滚回底部 → 恢复自动跟随
      if (isNearBottom) {
        if (userScrolled) setUserScrolled(false)
        return
      }

      // 忽略程序触发的滚动
      if (!userScrolled && isAutoScroll(container)) {
        return
      }
    }

    container.addEventListener('scroll', handleScroll)
    return () => container.removeEventListener('scroll', handleScroll)
  }, [userScrolled, distanceFromBottom, isAutoScroll, onScrollStatusChange])

  // 初始化时滚动到底部
  useEffect(() => {
    if (messages.length === 0) return
    const id = setTimeout(() => scrollToBottom('auto'), 50)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 消息变化时自动滚动（只在 !userScrolled 时）
  useEffect(() => {
    if (userScrolled) return
    scrollToBottom('auto')
  }, [messages, userScrolled, scrollToBottom])

  // 发送中内容持续更新：定期滚到底部
  useEffect(() => {
    if (!isSending || userScrolled) return

    const timer = setInterval(() => {
      if (userScrolled) return
      const el = containerRef.current
      if (!el) return
      if (distanceFromBottom(el) < 2) return
      scrollToBottom('auto')
    }, 150)

    return () => clearInterval(timer)
  }, [isSending, userScrolled, scrollToBottom, distanceFromBottom])

  return { containerRef, messagesEndRef, userScrolled }
}
