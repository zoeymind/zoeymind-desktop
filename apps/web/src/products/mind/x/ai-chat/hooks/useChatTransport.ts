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

// ============ 桌面端本地流实现 ============

import {
  createUIMessageStream,
  createUIMessageStreamResponse
} from 'ai'
import { loadModelsConfig, streamChat, type StreamChatMessage, type StreamChatHandle } from '@/shared/native'
import { createUUID } from '@/shared/app-shared'

interface UIMessagePart {
  type: string
  text?: string
  content?: string
}

interface UIMessageIn {
  id?: string
  role: 'user' | 'assistant' | 'system'
  content?: string
  parts?: UIMessagePart[]
}

/** UI message parts -> 单一 content 字符串 (拼所有 text-* / text 部分). */
function flattenParts(msg: UIMessageIn): string {
  if (typeof msg.content === 'string' && msg.content) return msg.content
  if (!Array.isArray(msg.parts)) return ''
  return msg.parts
    .map(p => {
      if (typeof p.text === 'string') return p.text
      if (typeof p.content === 'string') return p.content
      return ''
    })
    .filter(Boolean)
    .join('\n')
}

/**
 * 桌面端: useChat 里的 customFetch 最后统一调这个. 走 tauri chat_stream native
 * reqwest 拉服务商的 SSE, 用 AI SDK 官方 createUIMessageStream + writer 转成
 * v6 UI Message Stream Response 交回 useChat.
 *
 * 中止: init.signal 由 useChat.stop() 触发 -> abort streamChat handle,
 * 让 Rust 侧任务真的取消, 不再吐 delta.
 */
async function runLocalStream(
  body: {
    messages: UIMessageIn[]
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

  const chatMessages: StreamChatMessage[] = []
  const sys = [body.userPrompt, body.mindmapContextText].filter(Boolean).join('\n\n').trim()
  if (sys) chatMessages.push({ role: 'system', content: sys })
  for (const m of body.messages) {
    const text = flattenParts(m)
    if (!text) continue
    chatMessages.push({ role: m.role, content: text })
  }

  const textId = `t-${createUUID()}`

  const stream = createUIMessageStream({
    execute: async ({ writer }) => {
      writer.write({ type: 'start' })
      writer.write({ type: 'start-step' })
      writer.write({ type: 'text-start', id: textId })

      let handle: StreamChatHandle | null = null
      let doneResolve: (() => void) | null = null
      const done = new Promise<void>(resolve => {
        doneResolve = resolve
      })

      // useChat.stop() 触发的 abort -> 立即中断 Rust 侧任务
      const onAbort = () => {
        void handle?.abort()
        writer.write({ type: 'abort', reason: 'user' })
        writer.write({ type: 'finish' })
        doneResolve?.()
      }
      signal?.addEventListener('abort', onAbort, { once: true })

      try {
        handle = await streamChat({
          provider,
          model: entry.name,
          messages: chatMessages,
          onDelta: (text: string) => {
            writer.write({ type: 'text-delta', id: textId, delta: text })
          },
          onDone: () => {
            writer.write({ type: 'text-end', id: textId })
            writer.write({ type: 'finish-step' })
            writer.write({ type: 'finish' })
            doneResolve?.()
          },
          onError: (msg: string) => {
            writer.write({ type: 'error', errorText: msg })
            writer.write({ type: 'finish-step' })
            writer.write({ type: 'finish' })
            doneResolve?.()
          }
        })
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        writer.write({ type: 'error', errorText: msg })
        writer.write({ type: 'finish-step' })
        writer.write({ type: 'finish' })
        doneResolve?.()
      }

      await done
      signal?.removeEventListener('abort', onAbort)
    }
  })

  return createUIMessageStreamResponse({ stream })
}