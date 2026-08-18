/**
 * @zoeymind-ext-mind 桥接层 —— 桌面端极简版。
 *
 * AI Chat 面板目前不接（用户方案：等模型配置就绪后再接）。这里保留原表面
 * (AIChatProvider / AIFeaturePanel / AIStatusBadge / useAIProcessing /
 * resolveMindmapShortId / attachGhostCompletion) 让 MindMapCanvas / FormatPanel
 * 编译不改，运行时全部 no-op。
 */
import type { ReactElement, ReactNode } from 'react'

export { attachGhostCompletion } from './plugins/ghost-completion'

export function AIChatProvider({ children }: { children: ReactNode }): ReactElement {
  return <>{children}</>
}

export function AIFeaturePanel(_props: { isActive?: boolean }): ReactElement | null {
  return null
}

export function AIStatusBadge(): ReactElement | null {
  return null
}

export function useAIProcessing(): boolean {
  return false
}

export function resolveMindmapShortId(nodeId: string): string {
  return nodeId
}
