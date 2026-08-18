// @ts-nocheck — dormant AI chat / MCP module (bridge.tsx flattens to no-op)
/**
 * ActivePromptsIndicator — Sparkles 按钮 + Hover 展示当前已启用的 prompts 列表.
 *
 * 显示规则:
 *   - 按钮永远是 Sparkles 图标, 跟之前一样可点开 PromptManager
 *   - 有启用 prompts 时, 角标显示数量
 *   - hover 显示具体名字列表
 *   - 没启用任何 prompt 时, hover 显示提示 "未启用任何提示词"
 */

import { Sparkles } from 'lucide-react'
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@zoeymind/ui'
import { useTranslation } from '@zoeymind/i18n'
import { cn } from '@/shared/app-shared'

export interface ActivePromptItem {
  id: string
  name: string
}

interface ActivePromptsIndicatorProps {
  enabledPrompts: ActivePromptItem[]
  onClick: () => void
  title?: string
}

export function ActivePromptsIndicator({
  enabledPrompts,
  onClick,
  title
}: ActivePromptsIndicatorProps) {
  const { t } = useTranslation()
  const count = enabledPrompts.length

  return (
    <HoverCard>
      <HoverCardTrigger
        delay={200}
        render={
          <button
            type="button"
            onClick={onClick}
            className="relative flex items-center justify-center size-6 rounded hover:bg-muted transition-colors"
            title={title ?? t('mindmap.aiChat.core.promptLibrary')}
          >
            <Sparkles
              className={cn('size-3', count > 0 ? 'text-primary' : 'text-muted-foreground')}
            />
            {count > 0 && (
              <span
                className={cn(
                  'absolute -top-0.5 -right-0.5 min-w-[12px] h-3 px-1',
                  'rounded-full bg-primary text-primary-foreground',
                  'text-[9px] leading-3 font-medium',
                  'flex items-center justify-center'
                )}
              >
                {count > 9 ? '9+' : count}
              </span>
            )}
          </button>
        }
      />
      <HoverCardContent className="w-auto max-w-xs p-2 text-xs" side="bottom" align="end">
        {count === 0 ? (
          <div className="text-muted-foreground">{t('mindmap.aiChat.core.activePromptsEmpty')}</div>
        ) : (
          <div className="flex flex-col gap-1">
            <div className="font-medium text-foreground">
              {t('mindmap.aiChat.core.activePromptsTitle', { count })}
            </div>
            <ul className="flex flex-col gap-0.5 text-muted-foreground">
              {enabledPrompts.map(p => (
                <li key={p.id} className="truncate">
                  · {p.name}
                </li>
              ))}
            </ul>
          </div>
        )}
      </HoverCardContent>
    </HoverCard>
  )
}