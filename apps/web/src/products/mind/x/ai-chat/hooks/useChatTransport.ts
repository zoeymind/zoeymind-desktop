// @ts-nocheck — dormant AI chat / MCP module (bridge.tsx flattens to no-op)
/**
 * useChatTransport — 构造给 DefaultChatTransport 用的 customFetch.
 *
 * 职责:
 *   1. 把 mergedUserPrompt / selectedKnowledgeBaseIds / mcpServers / organizationId 注入 body
 *   2. 调用 MindmapContextManager.prepareContext() 拿到 ZTDL FULL / DIFF / NO_CHANGE 文本注入 body
 *   3. 把消息历史里旧 tool result 的 ztdl 字段提升为 data, 省 token (ZTDL 中间件)
 *   4. 异步持久化思维导图快照到 IndexedDB
 *
 * 注意: 第 2/3 步只在非 tool-result roundtrip 时做, 避免覆盖之前的 FULL/DIFF.
 */

import { useMemo } from 'react'
import { useMindMapStore } from '@/products/mind/features/mindmap/stores/mindmap-store'
import { useAIChatV2Store } from '../../ai-chat/stores/useAIChatV2Store'
import { chatDB } from '../../ai-chat/storage/chatDB'
import { getMindmapContextEnabled } from '../../ai-chat/hooks/useUserPrompt'
import { getEnabledToolNames } from '../../ai-chat/hooks/useToolSettings'
import { logger } from '@zoeymind/logger'
import type { ChatRuntime } from './internal/chatRuntime'
import type { UIMessage } from '@ai-sdk/react'
import {
  recallForQuery,
  extractLatestUserText,
  getRecentMessageIds
} from '../../ai-chat/memory/recall'

interface UseChatTransportOptions {
  runtime: ChatRuntime
  currentOrgId: string | undefined
}

/** 返回一个稳定的 fetch 函数, 供 DefaultChatTransport 使用. */
export function useChatTransport({ runtime, currentOrgId }: UseChatTransportOptions) {
  return useMemo(() => {
    return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const userPrompt = useAIChatV2Store.getState().mergedUserPrompt
      const selectedKnowledgeBaseIds = useAIChatV2Store.getState().selectedKnowledgeBaseIds
      // 读用户在设置里勾选的"可开关工具"白名单, 注入 body 供后端过滤
      const enabledToolNames = getEnabledToolNames()
      // 判断是否为 tool result 自动回发: 如果最后一条消息是 assistant (包含 tool call),
      // 是 SDK 自动回发 tool result, 此时不应重新获取上下文 (避免覆盖之前的 FULL/DIFF)
      let mindmapContextText: string | undefined
      const contextEnabled = getMindmapContextEnabled()

      const originalBody = init?.body ? JSON.parse(init.body as string) : {}
      const bodyMessages: Array<{ role?: string }> = originalBody.messages || []
      const lastMessage = bodyMessages.length > 0 ? bodyMessages[bodyMessages.length - 1] : null
      const isToolResultRoundtrip = lastMessage?.role === 'assistant'

      if (contextEnabled && !isToolResultRoundtrip) {
        try {
          const mindMap = useMindMapStore.getState().mindMap
          const manager = runtime.mindmapContextManager.current
          if (mindMap && manager) {
            const { text } = manager.prepareContext()
            mindmapContextText = text
            manager.markSent()
            // 异步持久化快照到 IndexedDB (不阻塞发送)
            const convId = useAIChatV2Store.getState().currentConversationId
            const snapshot = manager.getSnapshot()
            if (convId && snapshot) {
              chatDB.saveSnapshot(convId, {
                version: snapshot.version,
                nodes: snapshot.nodes.map(({ path: _, ...rest }) => rest),
                timestamp: snapshot.timestamp,
                idMapping: manager.idMapper.serialize()
              })
            }
          } else {
            logger.warn('[useChatTransport] mindMap 或 manager 不存在', {
              hasMindMap: !!mindMap,
              hasManager: !!manager
            })
          }
        } catch (error) {
          logger.warn('[useChatTransport] 获取思维导图上下文失败', { error })
        }
      }

      // 长期记忆召回 (cross-conversation semantic recall):
      // 只在非 tool-roundtrip 时跑, 失败 / 未启用 / 未 ready 都静默 fallback 到不注入
      let memoryContextText: string | undefined
      if (!isToolResultRoundtrip) {
        try {
          const messages = originalBody.messages as UIMessage[] | undefined
          if (messages && messages.length > 0) {
            const queryText = extractLatestUserText(messages)
            const excludeIds = getRecentMessageIds(messages)
            const recall = await recallForQuery(queryText, excludeIds)
            if (recall) memoryContextText = recall.injectedText
          }
        } catch (error) {
          logger.warn('[useChatTransport] 长期记忆召回失败', { error })
        }
      }

      // ZTDL 中间件: tool result 的 ztdl 字段提升为 data, 减少发给 AI 的 token
      // SDK v6 中 part.type 格式为 "tool-<toolName>" (如 "tool-add_module")
      if (originalBody.messages && Array.isArray(originalBody.messages)) {
        for (const msg of originalBody.messages) {
          if (msg.parts && Array.isArray(msg.parts)) {
            for (const part of msg.parts) {
              if (
                typeof part.type === 'string' &&
                part.type.startsWith('tool-') &&
                part.output?.ztdl
              ) {
                // 用 ZTDL 文本替代结构化 data, 删除 ztdl 字段
                part.output = {
                  success: part.output.success,
                  data: part.output.ztdl,
                  error: part.output.error
                }
              }
            }
          }
        }
      }

      // 把长期记忆召回结果拼到 userPrompt (后端 system prompt 直接接 userPrompt)
      const finalUserPrompt = memoryContextText
        ? userPrompt
          ? `${userPrompt}\n\n${memoryContextText}`
          : memoryContextText
        : userPrompt

      const newBody = {
        ...originalBody,
        userPrompt: finalUserPrompt,
        selectedKnowledgeBaseIds:
          selectedKnowledgeBaseIds.length > 0 ? selectedKnowledgeBaseIds : undefined,
        mindmapContextText,
        organizationId: currentOrgId,
        enabledToolNames
      }
      // 桌面端: 不走网络. 从 body 里挑 provider + model, 用 tauri chat_stream
      // 拉 SSE, 转成 AI SDK v6 UI Message Stream 返回给 useChat.
      return await runLocalStream(newBody, init?.signal ?? undefined)
    }
  }, [runtime, currentOrgId])
}

// ============ 桌面端本地流实现: streamText + tools + system prompt ============

import { streamText, convertToModelMessages, type UIMessage } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { loadModelsConfig, nativeFetch, type ModelProvider } from '@/shared/native'
import { buildSystemPrompt } from '../prompts/system-prompt'
import { getAgentTools } from '../agent-tools'

function resolveBaseURL(provider: ModelProvider): string | undefined {
  const raw = provider.baseURL?.trim()
  if (raw) return raw.replace(/\/+$/, '').replace(/\/v1$/, '')
  switch (provider.kind) {
    case 'openai':
      return 'https://api.openai.com'
    case 'ollama':
      return 'http://localhost:11434'
    default:
      return undefined
  }
}

function makeLanguageModel(provider: ModelProvider, modelName: string) {
  const baseURL = resolveBaseURL(provider)
  switch (provider.kind) {
    case 'openai': {
      const openai = createOpenAI({
        baseURL: baseURL ? `${baseURL}/v1` : undefined,
        apiKey: provider.apiKey ?? '',
        fetch: nativeFetch
      })
      return openai(modelName)
    }
    case 'openai-compatible':
    case 'ollama': {
      // Ollama 也有 /v1/chat/completions 兼容层, 走 openai-compatible.
      const oc = createOpenAICompatible({
        name: provider.kind === 'ollama' ? 'ollama' : 'openai-compatible',
        baseURL: baseURL ? `${baseURL}/v1` : 'http://localhost:11434/v1',
        apiKey: provider.apiKey || undefined,
        fetch: nativeFetch
      })
      return oc(modelName)
    }
    case 'anthropic': {
      const anthropic = createAnthropic({
        baseURL: baseURL ? `${baseURL}/v1` : undefined,
        apiKey: provider.apiKey ?? '',
        fetch: nativeFetch,
        headers: { 'anthropic-dangerous-direct-browser-access': 'true' }
      })
      return anthropic(modelName)
    }
    case 'gemini': {
      const google = createGoogleGenerativeAI({
        baseURL: baseURL ? `${baseURL}/v1beta` : undefined,
        apiKey: provider.apiKey ?? '',
        fetch: nativeFetch
      })
      return google(modelName)
    }
    default:
      throw new Error(`不支持的 provider kind: ${String(provider.kind)}`)
  }
}

/**
 * 桌面端本地 agent 流:
 *   1. 从 body 挑 provider + model
 *   2. 拼 system prompt (buildSystemPrompt + userPrompt + mindmapContext)
 *   3. streamText({model, system, messages, tools, stopWhen}) 跑多步 tool loop
 *   4. result.toUIMessageStreamResponse(...) 直接返回给 useChat
 */
async function runLocalStream(
  body: {
    messages: UIMessage[]
    model?: string
    userPrompt?: string
    mindmapContextText?: string
  },
  signal?: AbortSignal
): Promise<Response> {
  const cfg = await loadModelsConfig()
  const modelName =
    body.model ??
    cfg.defaults.chat ??
    cfg.models[0]?.name ??
    ''
  const entry =
    cfg.models.find(m => m.name === modelName || m.id === modelName) ??
    cfg.models[0]
  const provider = entry
    ? cfg.providers.find(p => p.id === entry.provider)
    : undefined

  if (!entry || !provider) {
    // 返回一个 UI Message Stream Response, 让 useChat 显示 error
    const { createUIMessageStream, createUIMessageStreamResponse } = await import('ai')
    return createUIMessageStreamResponse({
      stream: createUIMessageStream({
        execute: ({ writer }) => {
          writer.write({
            type: 'error',
            errorText: '未配置任何模型: 请到设置 -> 模型 勾选一个'
          })
        }
      })
    })
  }

  const systemParts = [buildSystemPrompt()]
  if (body.userPrompt) systemParts.push(`---\n\n${body.userPrompt}`)
  if (body.mindmapContextText) {
    systemParts.push(`---\n\n当前思维导图状态：\n${body.mindmapContextText}`)
  }
  const systemContent = systemParts.join('\n\n')

  const modelMessages = await convertToModelMessages(body.messages)

  const model = makeLanguageModel(provider, entry.name)
  const tools = getAgentTools()

  const result = streamText({
    model,
    tools,
    system: systemContent,
    messages: modelMessages,
    abortSignal: signal,
    maxRetries: 2
  })

  return result.toUIMessageStreamResponse({
    originalMessages: body.messages,
    onError: (error: unknown) =>
      error instanceof Error ? error.message : String(error)
  })
}