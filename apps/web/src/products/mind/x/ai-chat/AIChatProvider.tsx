// @ts-nocheck — desktop mirror of cloud AI chat; runtime bridged via bridge.tsx
/**
 * AIChatProvider — 在 MindMapCanvas 顶层挂载 AI 聊天运行时.
 *
 * useAIChat() 创建 useChat 实例并返回 AIChatRuntime (messages/status/error + 动作句柄),
 * 通过 AIChatRuntimeProvider 下发. 所有 useAIChatRuntime() 消费者
 * (FormatPanel / UnifiedAIPanel / AIchatV2 / MessageView / InputView) 必须在本组件之内.
 *
 * 挂在 Canvas 层而非 AIchatV2 内的原因: FormatPanel 需要 status 显示"AI 运行中"徽标,
 * 但 FormatPanel 是 AIchatV2 的祖先 (FormatPanel → UnifiedAIPanel → AIchatV2),
 * runtime 必须在共同祖先创建.
 */

import type { ReactNode, ReactElement } from 'react'
import { useAIChat } from './hooks/useAIChat'
import { AIChatRuntimeProvider } from './context/AIChatRuntimeContext'
import { useProjectMindMapStore as useMindMapStore } from '@/products/mind/editor-session'

export function AIChatProvider({ children }: { children: ReactNode }): ReactElement {
  const { mindMap } = useMindMapStore()
  const runtime = useAIChat((mindMap as { workspaceId?: string } | null)?.workspaceId)
  return <AIChatRuntimeProvider runtime={runtime}>{children}</AIChatRuntimeProvider>
}
