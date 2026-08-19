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
      return await runLocalStream(newBody)
    }
  }, [runtime, currentOrgId])
}

// ============ 桌面端本地流实现 ============

import { loadModelsConfig, streamChat, type StreamChatMessage } from '@/shared/native'
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

function encodeSse(chunk: unknown): Uint8Array {
  const line = `data: ${JSON.stringify(chunk)}\n\n`
  return new TextEncoder().encode(line)
}

/**
 * 从 useChat body 拉 provider/model, 用 tauri invoke chat_stream 拿 SSE,
 * 把 delta 转成 AI SDK v6 UI Message Stream chunks (text-start / text-delta / text-end
 * / finish) 输出 Response.
 *
 * body 结构 (AI SDK v6 sendMessage):
 *   { id: '...', messages: UIMessage[], model?: string }
 * 我们额外接受 body.provider (可选) 或从 models.json 按 model.name 反查 provider.
 */
async function runLocalStream(body: {
  messages: UIMessageIn[]
  model?: string
  userPrompt?: string
  mindmapContextText?: string
}): Promise<Response> {
  const cfg = await loadModelsConfig()
  // 优先取 body.model, 没传就用 defaults.chat, 再没有就取第一个 cfg.models.
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
    return sseErrorResponse('未配置任何模型: 请到设置 -> 模型 勾选一个')
  }

  const chatMessages: StreamChatMessage[] = []
  const sys = [body.userPrompt, body.mindmapContextText].filter(Boolean).join('\n\n').trim()
  if (sys) chatMessages.push({ role: 'system', content: sys })
  for (const m of body.messages) {
    const text = flattenParts(m)
    if (!text) continue
    chatMessages.push({ role: m.role, content: text })
  }

  const textId = `text-${createUUID()}`
  let controllerRef: ReadableStreamDefaultController<Uint8Array> | null = null

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      controllerRef = controller
      controller.enqueue(encodeSse({ type: 'start' }))
      controller.enqueue(encodeSse({ type: 'start-step' }))
      controller.enqueue(encodeSse({ type: 'text-start', id: textId }))

      try {
        await streamChat({
          provider,
          model: entry.name,
          messages: chatMessages,
          onDelta: (text: string) => {
            controller.enqueue(
              encodeSse({ type: 'text-delta', id: textId, delta: text })
            )
          },
          onDone: () => {
            controller.enqueue(encodeSse({ type: 'text-end', id: textId }))
            controller.enqueue(encodeSse({ type: 'finish-step' }))
            controller.enqueue(encodeSse({ type: 'finish' }))
            controller.close()
          },
          onError: (msg: string) => {
            controller.enqueue(encodeSse({ type: 'error', errorText: msg }))
            controller.close()
          }
        })
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        controller.enqueue(encodeSse({ type: 'error', errorText: msg }))
        controller.close()
      }
    },
    cancel() {
      // useChat.stop() 走这里; onError/onDone 未触发时 controllerRef 已 null.
      controllerRef = null
    }
  })

  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'x-vercel-ai-ui-message-stream': 'v1'
    }
  })
}

function sseErrorResponse(message: string): Response {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encodeSse({ type: 'start' }))
      controller.enqueue(encodeSse({ type: 'error', errorText: message }))
      controller.close()
    }
  })
  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream',
      'x-vercel-ai-ui-message-stream': 'v1'
    }
  })
}