// @ts-nocheck
/**
 * 模型选择器 Hook (AIchatV2) —— 桌面端本地版.
 *
 * 源: <appData>/models.json (cfg.providers + cfg.models). 保持返回形状与源版一致,
 * UI 不用改.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { logger } from '@zoeymind/logger'
import { loadModelsConfig, type ModelsConfig } from '@/shared/native'

const PROVIDER_ICONS: Record<string, string> = {
  openai: '/llmLogo/openai.svg',
  google: '/llmLogo/gemini.svg',
  gemini: '/llmLogo/gemini.svg',
  anthropic: '/llmLogo/claude.svg',
  ollama: '/llmLogo/openai.svg',
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
// 触发外部刷新 (设置面板保存新模型后 dispatch 这个事件).
const MODELS_UPDATED_EVENT = 'zm:models-updated'

export function useModelSelector() {
  const [cfg, setCfg] = useState<ModelsConfig | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const refresh = useCallback(() => {
    setIsLoading(true)
    void loadModelsConfig()
      .then(setCfg)
      .catch(err => logger.error('loadModelsConfig', err))
      .finally(() => setIsLoading(false))
  }, [])

  useEffect(() => {
    refresh()
    const onUpdate = () => refresh()
    window.addEventListener(MODELS_UPDATED_EVENT, onUpdate)
    return () => window.removeEventListener(MODELS_UPDATED_EVENT, onUpdate)
  }, [refresh])

  const models: AIModel[] = useMemo(() => {
    if (!cfg) return []
    return cfg.models.flatMap(m => {
      const p = cfg.providers.find(p => p.id === m.provider)
      if (!p) return []
      return [
        {
          id: m.name, // 用 model.name 作为 id, 直接是 provider 那边可识别的字符串
          name: m.name,
          description: null,
          provider: p.kind,
          hasVision: m.capabilities?.includes('vision') ?? false,
          hasToolCalling: m.capabilities?.includes('tools') ?? false,
          icon: PROVIDER_ICONS[p.kind],
          maxContextTokens: undefined,
          pricingNote: null
        }
      ]
    })
  }, [cfg])

  const defaultModelId = cfg?.defaults?.chat ?? models[0]?.id

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
    return defaultModelId ?? models[0].id
  }, [models, selectedModel, defaultModelId])

  const setSelectedModel = (modelId: string) => {
    setSelectedModelState(modelId)
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, modelId)
    } catch (error) {
      logger.warn('Failed to save model to localStorage:', error)
    }
  }

  const isAIConfigured = models.length > 0

  return {
    models,
    selectedModel: effectiveSelectedModel,
    setSelectedModel,
    isAIConfigured,
    isLoading
  }
}
