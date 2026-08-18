/**
 * AI Guide Hook
 * 管理 AI 助手引导的状态和逻辑
 */

import { useState, useEffect, useCallback } from 'react'
import { useUIStore } from '@/products/mind/stores'
import { AI_GUIDE_STORAGE_KEY } from './aiGuide'
import type { default as MindMapClass } from 'simple-mind-map'

export function useAIGuide(mindMap: MindMapClass | null, canEdit: boolean) {
  const [showWelcome, setShowWelcome] = useState(false)
  const [joyrideRun, setJoyrideRun] = useState(false)
  const [joyrideKey, setJoyrideKey] = useState(0)
  const { openFormatTab } = useUIStore()

  // 检查是否已显示过引导
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!canEdit) return // 只读模式不显示引导
    if (!mindMap) return

    const dismissed = localStorage.getItem(AI_GUIDE_STORAGE_KEY)
    if (dismissed) return

    // 延迟显示，确保页面已加载完成
    const timer = setTimeout(() => {
      setShowWelcome(true)
    }, 1000)
    return () => clearTimeout(timer)
  }, [mindMap, canEdit])

  const closeWelcome = useCallback(() => {
    setShowWelcome(false)
    if (typeof window !== 'undefined') {
      localStorage.setItem(AI_GUIDE_STORAGE_KEY, 'true')
    }
  }, [])

  const handleStartJoyride = useCallback(() => {
    closeWelcome()
    // 确保 AI 面板已打开
    openFormatTab('ai')
    // 延迟启动引导，确保面板已渲染
    setTimeout(() => {
      setJoyrideKey(prev => prev + 1)
      setJoyrideRun(true)
    }, 300)
  }, [closeWelcome, openFormatTab])

  const handleJoyrideCallback = useCallback((status: string) => {
    if (status === 'finished' || status === 'skipped') {
      setJoyrideRun(false)
      if (status === 'finished') {
        localStorage.setItem(AI_GUIDE_STORAGE_KEY, 'true')
      }
    }
  }, [])

  return {
    showWelcome,
    setShowWelcome,
    joyrideRun,
    joyrideKey,
    closeWelcome,
    handleStartJoyride,
    handleJoyrideCallback
  }
}
