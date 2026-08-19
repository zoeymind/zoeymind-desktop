/**
 * @zoeymind-ext-mind 桥接层 —— 桌面端启用真实 AIchatV2 UI, 请求走本地 tauri.
 *
 * 只替换了两处内部实现:
 *   - hooks/useChatTransport.ts: fetch() -> runLocalStream() (native reqwest 拉流,
 *     转 AI SDK v6 UI Message Stream chunks)
 *   - hooks/useModelSelector.ts: trpc.models.list -> loadModelsConfig()
 *
 * 其它 UI (MessageView / InputView / SettingsDialog / History) 全部保留原样.
 */
// @ts-nocheck
import { AIchatV2 } from './ai-chat'
import { AIChatProvider as OriginalAIChatProvider } from './ai-chat/AIChatProvider'

interface AIFeaturePanelProps {
  isActive?: boolean
}

export function AIChatProvider(props: { children: React.ReactNode }): JSX.Element {
  return <OriginalAIChatProvider {...props} />
}

export function AIFeaturePanel({ isActive }: AIFeaturePanelProps): JSX.Element | null {
  return <AIchatV2 isActive={isActive} />
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
