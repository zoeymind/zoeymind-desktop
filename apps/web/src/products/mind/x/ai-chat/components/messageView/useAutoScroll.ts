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

import { useCallback, useEffect, useRef } from 'react'
import { useStickToBottom } from 'use-stick-to-bottom'
import type { UIMessage } from '@ai-sdk/react'

interface UseAutoScrollProps {
  messages: UIMessage[]
  isSending?: boolean
  onScrollStatusChange?: (isNearBottom: boolean) => void
}

export function useAutoScroll({ messages, isSending: _isSending, onScrollStatusChange }: UseAutoScrollProps) {
  // initial: 'auto' -> 首次挂载直接跳底 (无动画, 打开对话不闪);
  // resize: 'smooth' -> 流式增高时 spring 追底.
  const {
    scrollRef,
    contentRef,
    isAtBottom,
    scrollToBottom
  } = useStickToBottom({ initial: 'auto', resize: 'smooth' })

  const messagesEndRef = useRef<HTMLDivElement>(null)

  // 状态回传给面板容器 (显示"回到底部"按钮).
  useEffect(() => {
    onScrollStatusChange?.(isAtBottom)
  }, [isAtBottom, onScrollStatusChange])

  // 新消息到来时如果当前在底部, 库会自动追加; 但对 messages.length 变化
  // 主动 nudge 一次, 避免边缘情况下 ResizeObserver 未及时触发.
  useEffect(() => {
    if (isAtBottom) void scrollToBottom('smooth')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length])

  // 兼容旧 API: 消费方拿到的 scrollToBottom 无参; 内部转发给库.
  const scrollToBottomCompat = useCallback(() => {
    void scrollToBottom('smooth')
  }, [scrollToBottom])

  return {
    containerRef: scrollRef,
    contentRef,
    messagesEndRef,
    isAtBottom,
    scrollToBottom: scrollToBottomCompat
  }
}
