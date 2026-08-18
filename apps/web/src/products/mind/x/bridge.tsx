// @ts-nocheck — dormant AI chat / MCP module
/**
 * @zoeymind-ext-mind 桥接层 ——
 *
 * AI Chat 尚未在桌面端接后端 (no /api/ai-v2/chat). 现在直接挂 AIchatV2 会:
 *   - useConversationLifecycle 拉 IndexedDB 建对话
 *   - useChat (AI SDK) 内部初始化流控/事件, 加上未接的 transport 反复重试
 *   - useMCPTools / trpc.mcp / trpc.models 各种 hook 效应
 * 组合起来在开发端触发 Maximum update depth (setState 竞态).
 *
 * 桌面端 AI 后端真正接入前, `AIFeaturePanel` 只显示一个"AI 未配置 · 前往设置"
 * 的**静态空状态**面板 (无 hooks 副作用). 等配置好模型后再切回真实 AIchatV2.
 */
import type { ReactNode } from 'react'
import { Sparkles } from 'lucide-react'
import { Button } from '@zoeymind/ui'

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function AIChatProvider({ children }: { children: ReactNode }): JSX.Element {
  // 不再挂真实的 useAIChat/useChat 运行时, 避免它内部 setState 循环.
  return <>{children}</>
}

interface AIFeaturePanelProps {
  isActive?: boolean
}

export function AIFeaturePanel({ isActive }: AIFeaturePanelProps): JSX.Element | null {
  if (!isActive) return null
  return (
    <div
      className="fixed top-12 right-4 z-10 flex h-[calc(100vh-96px)] w-[360px] flex-col rounded-lg border bg-card text-card-foreground shadow-lg"
    >
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <Sparkles className="size-4 text-primary" />
        <span className="text-sm font-medium">AI Chat</span>
      </div>
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
        <div className="flex size-14 items-center justify-center rounded-full bg-muted">
          <Sparkles className="size-6 text-muted-foreground" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium">AI 尚未接入</p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            桌面端 AI 后端还没实现,
            <br />
            配置好模型 + 后端后再启用面板.
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => {
            // 打开侧栏设置 Dialog (点击 sidebar 底部齿轮同款入口).
            window.dispatchEvent(new CustomEvent('zm:open-settings'))
          }}
        >
          前往设置
        </Button>
      </div>
    </div>
  )
}

export function AIStatusBadge(): null {
  return null
}

export function useAIProcessing(): boolean {
  return false
}

export function resolveMindmapShortId(nodeId: string): string {
  return nodeId
}

export { attachGhostCompletion } from './plugins/ghost-completion'
