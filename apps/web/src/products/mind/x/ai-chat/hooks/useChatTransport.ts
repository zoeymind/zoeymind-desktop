// @ts-nocheck — desktop AI chat transport
import { useMemo } from "react"
import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  pruneMessages,
  streamText,
  type ToolSet,
  type UIMessage,
} from "ai"
import { logger } from "@zoeymind/logger"
import { useProjectSessionStore } from "@/products/mind/editor-session"
import {
  createLanguageModel,
  loadModelsConfig,
  resolveChatModel,
  resolveDefaultChatModel,
} from "@/shared/native"
import { getAgentTools } from "../agent-tools"
import { contextCompactor } from "../compaction/ContextCompactor"
import { getMindmapContextEnabled } from "./useUserPrompt"
import { getEnabledToolNames } from "./useToolSettings"
import { buildSystemPrompt } from "../prompts/system-prompt"
import { chatDB } from "../storage/chatDB"
import { useAIChatV2Store } from "../stores/useAIChatV2Store"
import { normalizeChatError } from "../utils/errorHandler"
import { extractLatestUserText, getRecentMessageIds, recallForQuery } from "../memory/recall"
import type { ChatRuntime } from "./internal/chatRuntime"

interface UseChatTransportOptions {
  runtime: ChatRuntime
  currentOrgId?: string
}

interface PreparedTurn {
  userPrompt: string | undefined
  memoryContextText: string | undefined
  mindmapContextText: string | undefined
  enabledToolNames: string[]
  systemContent: string
  requestedModelId: string
}

export const preparedTurnCache = new Map<string, PreparedTurn>()

function latestUser(messages: UIMessage[]): UIMessage | undefined {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index].role === "user") return messages[index]
  }
  return undefined
}

function buildAttemptKey(conversationId: string, messages: UIMessage[]): string | null {
  const user = latestUser(messages)
  return user ? `${conversationId}:${user.id}` : null
}

function cloneMessages(messages: UIMessage[]): UIMessage[] {
  return messages.map(message => ({
    ...message,
    parts: message.parts?.map(part => {
      const candidate = part as {
        type?: string
        output?: { ztdl?: string; success?: boolean; error?: string }
      }
      if (!candidate.type?.startsWith("tool-") || !candidate.output?.ztdl) return { ...part }
      return {
        ...part,
        output: {
          success: candidate.output.success,
          data: candidate.output.ztdl,
          error: candidate.output.error,
        },
      }
    }),
  })) as UIMessage[]
}

function assembleSystem(userPrompt?: string, memory?: string, mindmap?: string): string {
  const parts = [buildSystemPrompt()]
  const combinedPrompt = memory ? (userPrompt ? `${userPrompt}\n\n${memory}` : memory) : userPrompt
  if (combinedPrompt) parts.push(`---\n\n${combinedPrompt}`)
  if (mindmap) parts.push(`---\n\n当前思维导图状态：\n${mindmap}`)
  return parts.join("\n\n")
}

export function clearPreparedTurn(key?: string): void {
  if (key) preparedTurnCache.delete(key)
  else preparedTurnCache.clear()
}

export function useChatTransport({ runtime }: UseChatTransportOptions) {
  const sessionStore = useProjectSessionStore()
  return useMemo(
    () =>
      async (_input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
        const body = init?.body ? JSON.parse(init.body as string) : {}
        const transcript = (body.messages ?? []) as UIMessage[]
        const conversationId = useAIChatV2Store.getState().currentConversationId
        if (!conversationId) return errorResponse("REQUEST_FAILED")
        const attemptKey = buildAttemptKey(conversationId, transcript)
        if (!attemptKey) return errorResponse("REQUEST_FAILED")
        const forced = body.compactionMode === "force-overflow-recovery"
        let prepared: PreparedTurn | undefined

        if (forced) {
          prepared = preparedTurnCache.get(body.logicalTurnId ?? attemptKey)
          if (!prepared) return errorResponse("CONTEXT_OVERFLOW")
        } else {
          const enabledToolNames = getEnabledToolNames()
          let mindmapContextText: string | undefined
          let memoryContextText: string | undefined
          const last = transcript[transcript.length - 1]
          const isToolResultRoundtrip =
            last?.role === "assistant" &&
            last.parts?.some(part => String((part as { type?: string }).type).startsWith("tool-"))

          if (getMindmapContextEnabled() && !isToolResultRoundtrip) {
            try {
              const mindMap = sessionStore.getState().mindMap
              const manager = runtime.mindmapContextManager.current
              if (mindMap && manager) {
                mindmapContextText = manager.prepareContext().text
                manager.markSent()
                const snapshot = manager.getSnapshot()
                if (snapshot) {
                  void chatDB.saveSnapshot(conversationId, {
                    version: snapshot.version,
                    nodes: snapshot.nodes.map(({ path: _, ...rest }) => rest),
                    timestamp: snapshot.timestamp,
                    idMapping: manager.idMapper.serialize(),
                  })
                }
              }
            } catch (error) {
              logger.warn("[useChatTransport] 获取思维导图上下文失败", { error })
            }
          }
          if (!isToolResultRoundtrip) {
            try {
              const recall = await recallForQuery(
                extractLatestUserText(transcript),
                getRecentMessageIds(transcript)
              )
              memoryContextText = recall?.injectedText
            } catch (error) {
              logger.warn("[useChatTransport] 长期记忆召回失败", { error })
            }
          }
          const requestedModelId = String(body.model ?? "")
          const userPrompt = useAIChatV2Store.getState().mergedUserPrompt || undefined
          prepared = {
            userPrompt,
            memoryContextText,
            mindmapContextText,
            enabledToolNames,
            systemContent: assembleSystem(userPrompt, memoryContextText, mindmapContextText),
            requestedModelId,
          }
          preparedTurnCache.set(attemptKey, prepared)
        }

        return runLocalStream(
          {
            conversationId,
            transcript,
            requestedModelId: prepared.requestedModelId,
            systemContent: prepared.systemContent,
            enabledToolNames: prepared.enabledToolNames,
            force: forced,
            attemptKey,
          },
          init?.signal ?? undefined
        )
      },
    [runtime, sessionStore]
  )
}

function errorResponse(code: string): Response {
  return createUIMessageStreamResponse({
    stream: createUIMessageStream({
      execute: ({ writer }) => writer.write({ type: "error", errorText: code }),
    }),
  })
}

export async function runLocalStream(
  input: {
    conversationId: string
    transcript: UIMessage[]
    requestedModelId: string
    systemContent: string
    enabledToolNames: string[]
    force: boolean
    attemptKey: string
  },
  signal?: AbortSignal
): Promise<Response> {
  try {
    const config = await loadModelsConfig()
    const resolved = input.requestedModelId
      ? resolveChatModel(config, input.requestedModelId)
      : resolveDefaultChatModel(config)
    const tools = getAgentTools() as ToolSet
    const compacted = await contextCompactor.prepare({
      conversationId: input.conversationId,
      transcript: input.transcript,
      requestedModelId: resolved.entry.id,
      system: input.systemContent,
      tools,
      force: input.force,
      signal,
    })
    const modelMessages = pruneMessages({
      messages: await convertToModelMessages(cloneMessages(compacted.messages)),
      reasoning: "before-last-message",
      emptyMessages: "remove",
    })
    const result = streamText({
      model: createLanguageModel(resolved.provider, resolved.entry),
      tools,
      system: input.systemContent,
      messages: modelMessages,
      abortSignal: signal,
      maxRetries: 2,
      maxOutputTokens: resolved.entry.maxOutputTokens,
    })
    return result.toUIMessageStreamResponse({
      originalMessages: input.transcript,
      messageMetadata: ({ part }) => {
        if (part.type === "start") return { modelId: resolved.entry.id }
        if (part.type === "finish") {
          clearPreparedTurn(input.attemptKey)
          return { modelId: resolved.entry.id, totalUsage: part.totalUsage }
        }
      },
      onError: normalizeChatError,
    })
  } catch (error) {
    if (signal?.aborted) clearPreparedTurn(input.attemptKey)
    if (input.force) clearPreparedTurn(input.attemptKey)
    return errorResponse(input.force ? "CONTEXT_OVERFLOW" : normalizeChatError(error))
  }
}
