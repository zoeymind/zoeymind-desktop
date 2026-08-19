// @ts-nocheck — desktop mirror of cloud AI chat; runtime bridged via bridge.tsx
/**
 * ModelSelector - 模型选择器（DropdownMenu 下拉）。
 *
 * 用 @zoeymind/ui 的 DropdownMenu（Radix Portal）渲染下拉面板：内容挂到 body，
 * 逃逸父级滚动容器 / 面板的 overflow 裁剪（用户消息卡片内也能完整弹出），
 * 自带 duration-100 快展开动画。触发按钮只负责展示当前模型与旋转的 chevron。
 */

import React, { useState } from 'react'
import { Check, ChevronDown, Eye } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem
} from '@zoeymind/ui'
import { cn } from '@/shared/app-shared'
import { useTranslation } from '@zoeymind/i18n'
import type { AIModel } from '../../../ai-chat/hooks/useModelSelector'

interface ModelSelectorProps {
  models: AIModel[]
  selectedModel: string
  setSelectedModel: (modelId: string) => void
  disabled?: boolean
}

export const ModelSelector: React.FC<ModelSelectorProps> = ({
  models,
  selectedModel,
  setSelectedModel,
  disabled = false
}) => {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)

  const currentModel = models.find(m => m.id === selectedModel) ?? models[0]

  // 模型列表为空时显示占位 (API 加载中或服务暂时不可用)
  if (!currentModel) {
    return (
      <div className="flex h-6 items-center gap-1 rounded-md border border-border bg-card px-2 py-0.5 text-xs text-muted-foreground opacity-50">
        <span>{t('mindmap.aiChat.input.noModelConfigured')}</span>
      </div>
    )
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        nativeButton
        disabled={disabled}
        render={
          <button
            type="button"
            className={cn(
              'flex h-6 items-center gap-1 rounded-md px-2 py-0.5 text-xs transition-colors outline-none',
              'text-muted-foreground hover:bg-muted hover:text-foreground',
              'focus-visible:ring-1 focus-visible:ring-ring',
              disabled && 'cursor-not-allowed opacity-50'
            )}
            title={t('mindmap.aiChat.input.selectModel')}
          >
            {currentModel.icon && <img src={currentModel.icon} alt="" className="size-3" />}
            <span className="max-w-[80px] truncate">{currentModel.name}</span>
            {currentModel.hasVision && (
              <span title={t('mindmap.aiChat.input.supportsVision')}>
                <Eye className="size-3 text-primary" />
              </span>
            )}
            <ChevronDown className={cn('size-3 transition-transform', open && 'rotate-180')} />
          </button>
        }
      />
      <DropdownMenuContent side="top" align="start" className="max-h-[280px] w-auto min-w-[180px]">
        {models.map(model => (
          <DropdownMenuItem
            key={model.id}
            onSelect={() => setSelectedModel(model.id)}
            className={cn(
              'justify-between gap-2 px-2 py-1 text-xs',
              model.id === selectedModel && 'bg-accent'
            )}
          >
            <div className="flex min-w-0 flex-1 items-center gap-1.5">
              {model.icon && <img src={model.icon} alt="" className="size-3.5 flex-shrink-0" />}
              <span className="truncate">{model.name}</span>
            </div>
            <div className="flex items-center gap-1">
              {model.hasVision && (
                <span title={t('mindmap.aiChat.input.supportsVision')}>
                  <Eye className="size-3 text-primary" />
                </span>
              )}
              {model.id === selectedModel && (
                <Check className="size-3 flex-shrink-0 text-primary" />
              )}
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
