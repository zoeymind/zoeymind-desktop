// @ts-nocheck — dormant AI chat / MCP module (bridge.tsx renders empty state only)
/**
 * @zoeymind-ext-mind 桥接层 —— 桌面端极简版。
 *
 * AI Chat 面板尚未接入真实模型对话。此处保留原表面
 * (AIChatProvider / AIFeaturePanel / AIStatusBadge / useAIProcessing /
 * resolveMindmapShortId / attachGhostCompletion) 让 MindMapCanvas / FormatPanel
 * 编译不改，AIFeaturePanel 展开一个空状态面板 —— 提示去设置里配置模型。
 */
import { type ReactElement, type ReactNode } from 'react'
import { useTranslation } from '@zoeymind/i18n'
import { useNavigate } from 'react-router-dom'
import { Sparkles } from 'lucide-react'
import { Button } from '@zoeymind/ui'

export { attachGhostCompletion } from './plugins/ghost-completion'

export function AIChatProvider({ children }: { children: ReactNode }): ReactElement {
  return <>{children}</>
}

/**
 * 未接入真实 AI 时的空状态面板。样式与 FormatPanel 其他右侧面板 (Tags/Theme) 一致：
 * 固定右侧 320px + 全高 + 主题色背景 + 边框。
 */
export function AIFeaturePanel({ isActive }: { isActive?: boolean }): ReactElement | null {
  const { t } = useTranslation()
  const navigate = useNavigate()
  if (!isActive) return null
  return (
    <div
      className="fixed right-0 top-8 bottom-0 z-30 w-[320px] border-l bg-background flex flex-col"
      role="complementary"
    >
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <Sparkles className="size-4 text-primary" />
        <span className="text-sm font-medium">{t('mindmap.formatPanel.toolbar.aiAssistant')}</span>
      </div>
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
        <div className="flex size-14 items-center justify-center rounded-full bg-muted">
          <Sparkles className="size-6 text-muted-foreground" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium">尚未配置模型</p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            前往设置添加你的模型 API Key,<br />即可在此与 AI 对话辅助编辑思维导图。
          </p>
        </div>
        <Button size="sm" onClick={() => navigate('/settings')}>
          前往设置
        </Button>
      </div>
    </div>
  )
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
