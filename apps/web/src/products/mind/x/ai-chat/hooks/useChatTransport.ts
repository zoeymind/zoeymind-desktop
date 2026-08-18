/**
 * useChatTransport —— 桌面端本地版：不经服务器，直接按 models.json 派发到 provider。
 *
 * 老版本走后端 `/api/ai-v2/chat` + 大量上下文注入（ZTDL diff、长期记忆召回、MCP 工具白名单）。
 * 桌面端只有本地 AI SDK 直连；记忆/MCP/ZTDL 缩进为 no-op（挂进 goal 之后可以逐层接回来）。
 *
 * 使用方式：编辑器里的 useAIChat 会用 DefaultChatTransport({ fetch: customFetch })
 * 把这个 fetch 挂给 useChat。我们无视 URL，读 body.messages 直接 streamText。
 */

import { useMemo } from 'react'
import { streamText, convertToModelMessages } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import { createAnthropic } from '@ai-sdk/anthropic'
import type { UIMessage } from '@ai-sdk/react'
import type { LanguageModel } from 'ai'
import { logger } from '@zoeymind/logger'
import { loadModelsConfig, type ModelsConfig } from '@/shared/native'
import type { ChatRuntime } from './internal/chatRuntime'

interface UseChatTransportOptions {
  runtime: ChatRuntime
  currentOrgId: string | undefined
}

async function resolveModel(): Promise<LanguageModel | null> {
  const cfg: ModelsConfig = await loadModelsConfig()
  const selectedId = cfg.defaults.chat ?? cfg.models[0]?.id
  const model = cfg.models.find(m => m.id === selectedId)
  if (!model) return null
  const provider = cfg.providers.find(p => p.id === model.provider)
  if (!provider) return null

  switch (provider.kind) {
    case 'openai': {
      const factory = createOpenAI({ apiKey: provider.apiKey })
      return factory(model.name)
    }
    case 'anthropic': {
      const factory = createAnthropic({ apiKey: provider.apiKey })
      return factory(model.name)
    }
    case 'openai-compatible':
    case 'ollama': {
      if (!provider.baseURL) return null
      const factory = createOpenAICompatible({
        name: provider.id,
        baseURL: provider.baseURL,
        apiKey: provider.apiKey
      })
      return factory(model.name)
    }
    case 'gemini': {
      // 待接：@ai-sdk/google
      return null
    }
    default:
      return null
  }
}

export function useChatTransport(_opts: UseChatTransportOptions) {
  return useMemo(() => {
    return async (_input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const body = init?.body ? JSON.parse(init.body as string) : {}
      const messages = (body.messages ?? []) as UIMessage[]

      const model = await resolveModel()
      if (!model) {
        return new Response(
          JSON.stringify({ error: 'No AI model configured. Go to Settings to add one.' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        )
      }

      try {
        const result = streamText({
          model,
          messages: convertToModelMessages(messages)
        })
        return result.toUIMessageStreamResponse()
      } catch (error) {
        logger.error('[useChatTransport] streamText 失败', error)
        return new Response(
          JSON.stringify({ error: (error as Error).message }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        )
      }
    }
  }, [])
}
