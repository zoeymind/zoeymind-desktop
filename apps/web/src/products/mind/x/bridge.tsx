/**
 * @zoeymind-ext-mind 桥接层 —— 桌面端启用真实 AIchatV2 UI, 请求走本地 tauri.
 *
 * 只替换了两处内部实现:
 *   - hooks/useChatTransport.ts: fetch() -> runLocalStream() (native reqwest 拉流,
 *     转 AI SDK v6 UI Message Stream chunks)
 *   - hooks/useModelSelector.ts: trpc.models.list -> loadModelsConfig()
 */
// @ts-nocheck
import React, { Component, type ReactNode } from 'react'
import { AIchatV2 } from './ai-chat'
import { AIChatProvider as OriginalAIChatProvider } from './ai-chat/AIChatProvider'

interface AIFeaturePanelProps {
  isActive?: boolean
  resizeHandle?: {
    isDragging: boolean
    onMouseDown: (event: React.MouseEvent) => void
  }
}

class AIChatErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // 把 componentStack 完整打印, 便于定位 Maximum update depth 里的具体 Hook
    // eslint-disable-next-line no-console
    console.error(
      '[AIChatErrorBoundary]',
      error?.message,
      '\ncomponentStack:',
      info.componentStack,
      '\nfullError:',
      error
    )
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex h-full items-center justify-center bg-background p-4 text-xs">
          <div className="w-full rounded-lg border border-destructive p-4">
            <div className="mb-2 font-semibold text-destructive">AI 面板崩溃</div>
            <div className="mb-2 whitespace-pre-wrap text-muted-foreground">
              {this.state.error.message}
            </div>
            <button
              className="rounded bg-primary px-3 py-1 text-xs text-primary-foreground"
              onClick={() => this.setState({ error: null })}
            >
              重试
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

export function AIChatProvider(props: { children: React.ReactNode }): JSX.Element {
  return <OriginalAIChatProvider {...props} />
}

export function AIFeaturePanel({
  isActive,
  resizeHandle,
}: AIFeaturePanelProps): JSX.Element | null {
  return (
    <AIChatErrorBoundary>
      <AIchatV2 isActive={isActive} resizeHandle={resizeHandle} />
    </AIChatErrorBoundary>
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
