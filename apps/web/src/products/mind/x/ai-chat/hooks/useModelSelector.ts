/**
 * 模型选择器 Hook —— 桌面端本地版：读 models.json 而非 trpc.models.list。
 *
 * 数据源 = `<appData>/models.json` (loadModelsConfig)。用户在设置页维护 providers +
 * models + defaults；本 hook 组装成 AIModel[] 供 InputBox / ModelSelector 消费。
 *
 * 本地缓存: 选中的 modelId 存 localStorage; 列表更新后若旧 selectedModel 不在新列表里,
 * fallback 到 defaults.chat → 第一个。
 */

import { useEffect, useMemo, useState } from 'react'
import { loadModelsConfig, type ModelsConfig } from '@/shared/native'

const PROVIDER_ICONS: Record<string, string> = {
  openai: '/llmLogo/openai.svg',
  gemini: '/llmLogo/gemini.svg',
  anthropic: '/llmLogo/claude.svg',
  ollama: '/llmLogo/meta.svg',
  'openai-compatible': '/llmLogo/openai.svg'
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

function readSelected(): string {
  if (typeof window === 'undefined') return ''
  return window.localStorage.getItem(LOCAL_STORAGE_KEY) ?? ''
}

export function useModelSelector() {
  const [cfg, setCfg] = useState<ModelsConfig | null>(null)

  useEffect(() => {
    void loadModelsConfig().then(setCfg)
  }, [])

  const models: AIModel[] = useMemo(() => {
    if (!cfg) return []
    return cfg.models.map(m => {
      const provider = cfg.providers.find(p => p.id === m.provider)
      const kind = provider?.kind ?? 'openai'
      return {
        id: m.id,
        name: m.name || m.id,
        provider: kind,
        icon: PROVIDER_ICONS[kind],
        hasVision: m.capabilities?.includes('vision'),
        hasToolCalling: m.capabilities?.includes('tools')
      }
    })
  }, [cfg])

  const [selectedModel, setSelectedModelState] = useState<string>(readSelected)

  const effectiveSelectedModel = useMemo(() => {
    if (models.some(m => m.id === selectedModel)) return selectedModel
    return cfg?.defaults.chat ?? models[0]?.id ?? ''
  }, [models, selectedModel, cfg?.defaults.chat])

  const setSelectedModel = (modelId: string) => {
    setSelectedModelState(modelId)
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(LOCAL_STORAGE_KEY, modelId)
    }
  }

  const isAIConfigured = models.length > 0

  return {
    models,
    isLoading: cfg === null,
    selectedModel: effectiveSelectedModel,
    setSelectedModel,
    isAIConfigured
  }
}
