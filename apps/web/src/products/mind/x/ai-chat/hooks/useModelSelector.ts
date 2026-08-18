// @ts-nocheck — dormant AI chat / MCP module (bridge.tsx flattens to no-op)
/**
 * 模型选择器 Hook (AIchatV2)
 *
 * 数据源 = ZoeyMind `trpc.models.list` (PlatformModel, where isEnabled=true).
 * 不再依赖组织级 BYOK (`organization.aiConfig.listModels`) —— Phase B 之后 AI 调用统一走平台 AI 服务,
 * 模型清单由平台运营在 admin 后台决定.
 *
 * 本地缓存: 选中的 modelId 存 localStorage; 列表更新后若旧 selectedModel 不在新列表里,
 * 自动 fallback 到 defaultModelId (backend 决定) → 第一个.
 */

import { useState, useMemo } from 'react'
import type { ModelListResult } from '../../lib/api-types'
import { logger } from '@zoeymind/logger'
import { trpc } from '../../lib/trpc'

const PROVIDER_ICONS: Record<string, string> = {
  openai: '/llmLogo/openai.svg',
  google: '/llmLogo/gemini.svg',
  anthropic: '/llmLogo/claude.svg',
  deepseek: '/llmLogo/deepseek.svg',
  qwen: '/llmLogo/qwen.svg',
  zhipu: '/llmLogo/zhipu.svg',
  moonshot: '/llmLogo/moonshot.svg',
  meta: '/llmLogo/meta.svg',
  mistral: '/llmLogo/mistral.svg',
  xai: '/llmLogo/xai.svg'
}

export interface AIModel {
  id: string
  name: string
  description?: string | null
  provider: string
  hasVision?: boolean
  hasToolCalling?: boolean
  icon?: string
  maxContextTokens?: number
  pricingNote?: string | null
}

const LOCAL_STORAGE_KEY = 'aichatv2-selected-model'

export function useModelSelector() {
  // 模型清单来自平台级 aigate provider (organizationId=null), 全实例内共享.
  const { data, isLoading } = trpc.models.list.useQuery<ModelListResult>(undefined, {
    staleTime: 30_000
  })

  const models: AIModel[] = useMemo(() => {
    if (!data?.items) return []
    return data.items.map(m => ({
      id: m.modelId,
      name: m.name,
      description: m.description,
      provider: m.provider,
      hasVision: m.supportsVision,
      hasToolCalling: m.supportsTools,
      icon: m.iconUrl ?? PROVIDER_ICONS[m.provider] ?? undefined,
      maxContextTokens: m.contextLength ?? undefined,
      pricingNote: m.pricingNote
    }))
  }, [data])

  const [selectedModel, setSelectedModelState] = useState<string>(() => {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY)
      if (stored) return stored
    } catch (error) {
      logger.warn('Failed to read model from localStorage:', error)
    }
    return ''
  })

  const effectiveSelectedModel = useMemo(() => {
    if (models.length === 0) return selectedModel
    if (models.some(m => m.id === selectedModel)) return selectedModel
    return data?.defaultModelId ?? models[0].id
  }, [models, selectedModel, data?.defaultModelId])

  const setSelectedModel = (modelId: string) => {
    setSelectedModelState(modelId)
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, modelId)
    } catch (error) {
      logger.warn('Failed to save model to localStorage:', error)
    }
  }

  // 至少有 1 个上架模型即视为 "AI 已就绪"
  const isAIConfigured = models.length > 0

  return {
    models,
    selectedModel: effectiveSelectedModel,
    setSelectedModel,
    isAIConfigured,
    isLoading
  }
}