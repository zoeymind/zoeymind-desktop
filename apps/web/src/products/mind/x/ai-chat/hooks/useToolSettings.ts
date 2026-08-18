// @ts-nocheck — dormant AI chat / MCP module (bridge.tsx flattens to no-op)
/**
 * useToolSettings — AI 聊天"可开关工具"偏好.
 *
 * 与 useUserPrompt 里的思维导图上下文开关一致, 走 localStorage 做 per-browser 持久化
 * (这是浏览器级偏好, 不需要跨设备同步). 只管理 TOGGLEABLE_TOOL_NAMES 里的工具;
 * 思维导图 CRUD / question 等核心工具永远启用, 不在这里管理.
 *
 * 存储形态: 存"被禁用的工具名列表"而非"启用列表". 这样新增一个可开关工具时,
 * 老用户默认自动启用它 (不在禁用列表里 = 启用), 符合"默认全开"的预期.
 */

import { useCallback, useState } from 'react'
import { TOGGLEABLE_TOOL_NAMES, type ToggleableToolName } from '@zoeymind/shared'
import { logger } from '@zoeymind/logger'

const DISABLED_TOOLS_STORAGE_KEY = 'ai_chat_v2_disabled_tools'

/** 从 localStorage 读被禁用的工具名集合 (脏数据静默忽略). */
function readDisabledToolNames(): Set<string> {
  if (typeof window === 'undefined') return new Set()
  try {
    const raw = localStorage.getItem(DISABLED_TOOLS_STORAGE_KEY)
    if (!raw) return new Set()
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return new Set()
    return new Set(parsed.filter((name): name is string => typeof name === 'string'))
  } catch (error) {
    logger.warn('[useToolSettings] 读取工具开关失败, 回退到默认全开', { error })
    return new Set()
  }
}

function writeDisabledToolNames(disabled: Set<string>): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(DISABLED_TOOLS_STORAGE_KEY, JSON.stringify([...disabled]))
  } catch (error) {
    logger.warn('[useToolSettings] 保存工具开关失败', { error })
  }
}

/**
 * 计算当前"启用的可开关工具名列表", 供 useChatTransport 注入请求 body.
 *
 * 返回值语义与后端 chatBodySchema.enabledToolNames 对齐:
 *   - 默认 (没关任何工具) 也会返回完整白名单, 而不是 undefined, 让后端逻辑更直白.
 */
export function getEnabledToolNames(): ToggleableToolName[] {
  const disabled = readDisabledToolNames()
  return TOGGLEABLE_TOOL_NAMES.filter(name => !disabled.has(name))
}

export interface UseToolSettingsResult {
  /** 每个可开关工具当前是否启用 */
  enabledMap: Record<ToggleableToolName, boolean>
  /** 切换单个工具的启用状态 */
  setToolEnabled: (toolName: ToggleableToolName, enabled: boolean) => void
}

/** Hook: 管理可开关工具的启用状态 (设置面板用). */
export function useToolSettings(): UseToolSettingsResult {
  const [disabled, setDisabled] = useState<Set<string>>(() => readDisabledToolNames())

  const setToolEnabled = useCallback((toolName: ToggleableToolName, enabled: boolean) => {
    setDisabled(prev => {
      const next = new Set(prev)
      if (enabled) {
        next.delete(toolName)
      } else {
        next.add(toolName)
      }
      writeDisabledToolNames(next)
      return next
    })
  }, [])

  const enabledMap = Object.fromEntries(
    TOGGLEABLE_TOOL_NAMES.map(name => [name, !disabled.has(name)])
  ) as Record<ToggleableToolName, boolean>

  return { enabledMap, setToolEnabled }
}