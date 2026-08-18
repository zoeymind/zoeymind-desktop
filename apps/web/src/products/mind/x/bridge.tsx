// @ts-nocheck — dormant AI chat / MCP module (bridge.tsx wires real AI chat + provider)
/**
 * @zoeymind-ext-mind 桥接层 —— 桌面端把产品仓 AI Chat 面板真正接进来。
 *
 * `AIFeaturePanel` = 完整的 `AIchatV2` 面板 (右侧可拖拽宽度、历史、设置、
 * MessageView/InputView), 模型没配置时它自身有空状态; 有配置时可对话.
 * `AIChatProvider` = `apps/desktop/.../products/mind/x/ai-chat/AIChatProvider`
 * 已在 Canvas 顶层挂 useChat + runtime, 桥接层直接透传.
 */
export { AIChatProvider } from './ai-chat/AIChatProvider'
export { AIchatV2 as AIFeaturePanel } from './ai-chat/index'
export { attachGhostCompletion } from './plugins/ghost-completion'

export function AIStatusBadge(): null {
  return null
}

// FormatPanel 用它判断 AI 是否在跑; 真实状态由 useAIChatRuntime 提供,
// 这里给一个最简读法 —— 若 store 没同步值, 一律 false.
import { useAIChatRuntime } from './ai-chat/context/AIChatRuntimeContext'
export function useAIProcessing(): boolean {
  try {
    const runtime = useAIChatRuntime()
    const status = runtime?.status
    return status === 'submitted' || status === 'streaming'
  } catch {
    return false
  }
}

export function resolveMindmapShortId(nodeId: string): string {
  return nodeId
}
