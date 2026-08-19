// @ts-nocheck — desktop mirror of cloud AI chat; runtime bridged via bridge.tsx
/**
 * 用户自定义提示词管理
 *
 * 功能：
 * - 读取/保存用户自定义提示词到 localStorage
 * - 为每个 workspaceId 独立存储提示词
 * - 管理思维导图数据感知开关
 */

import { useState, useEffect } from 'react'
const USER_PROMPT_STORAGE_PREFIX = 'ai_chat_v2_user_prompt_'
const MINDMAP_CONTEXT_ENABLED_KEY = 'ai_chat_v2_mindmap_context_enabled'

/**
 * 获取用户自定义提示词
 */
export function getUserPrompt(workspaceId: string): string {
  const key = `${USER_PROMPT_STORAGE_PREFIX}${workspaceId}`
  return localStorage.getItem(key) || ''
}

/**
 * 保存用户自定义提示词
 */
export function setUserPrompt(workspaceId: string, prompt: string): void {
  const key = `${USER_PROMPT_STORAGE_PREFIX}${workspaceId}`
  if (prompt.trim()) {
    localStorage.setItem(key, prompt.trim())
  } else {
    localStorage.removeItem(key)
  }
}

/**
 * 获取思维导图数据感知开关状态
 */
export function getMindmapContextEnabled(): boolean {
  const value = localStorage.getItem(MINDMAP_CONTEXT_ENABLED_KEY)
  // 默认启用：未设置过（null）时返回 true
  const enabled = value !== 'false'
  return enabled
}

/**
 * 设置思维导图数据感知开关状态
 */
export function setMindmapContextEnabled(enabled: boolean): void {
  localStorage.setItem(MINDMAP_CONTEXT_ENABLED_KEY, enabled ? 'true' : 'false')
}

/**
 * Hook: 管理用户提示词状态
 */
export function useUserPrompt(workspaceId: string) {
  const [userPrompt, setUserPromptState] = useState(() =>
    workspaceId ? getUserPrompt(workspaceId) : ''
  )
  const [mindmapContextEnabled, setMindmapContextEnabledState] = useState(true)

  // 初始化时从 localStorage 加载

  // 保存到 localStorage
  const saveUserPrompt = (prompt: string) => {
    setUserPrompt(workspaceId, prompt)
    setUserPromptState(prompt)
  }

  // 保存思维导图数据感知开关状态
  const saveMindmapContextEnabled = (enabled: boolean) => {
    setMindmapContextEnabled(enabled)
    setMindmapContextEnabledState(enabled)
  }

  return {
    userPrompt,
    saveUserPrompt,
    mindmapContextEnabled,
    saveMindmapContextEnabled
  }
}
