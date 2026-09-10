import { useMemo } from "react"
import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  pruneMessages,
  streamText,
  stepCountIs,
  type ToolSet,
  type UIMessage,
} from "ai"
import { logger } from "@zoeymind/logger"
import { readCurrentDocumentOutline } from "@/products/mind/document-portal/current-document-adapter"
import {
  createLanguageModel,
  loadModelsConfig,
  resolveChatModel,
  resolveDefaultChatModel,
} from "@/shared/native"
import { getAgentTools } from "../agent-tools"
import { mcpManager } from "../../mcp-client"
import { contextCompactor } from "../compaction/ContextCompactor"
import { buildSystemPrompt } from "../prompts/system-prompt"
import { useAIChatV2Store } from "../stores/useAIChatV2Store"
import { serializeChatError } from "../utils/errorHandler"
import { extractLatestUserText, getRecentMessageIds, recallForQuery } from "../memory/recall"
import { getMindmapContextEnabled } from "./useUserPrompt"
import { describeRuntimeTools } from "./runtime-tools"

interface PreparedTurn {
  userPrompt: string | undefined
  memoryContextText: string | undefined
  mindmapContextText: string | undefined
  systemContent: string
  requestedModelId: string
}

export const preparedTurnCache = new Map<string, PreparedTurn>()

export function awaitWithAbort<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return promise
  if (signal.aborted)
    return Promise.reject(signal.reason ?? new DOMException("Aborted", "AbortError"))
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(signal.reason ?? new DOMException("Aborted", "AbortError"))
    signal.addEventListener("abort", onAbort, { once: true })
    promise.then(
      value => {
        signal.removeEventListener("abort", onAbort)
        resolve(value)
      },
      error => {
        signal.removeEventListener("abort", onAbort)
        reject(error)
      }
    )
  })
}

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

export function readTurnStartedAt(messages: UIMessage[]): number | undefined {
  const user = latestUser(messages)
  if (!user?.metadata || typeof user.metadata !== "object") return undefined
  const startedAt = (user.metadata as { turnStartedAt?: unknown }).turnStartedAt
  return typeof startedAt === "number" && Number.isFinite(startedAt) && startedAt >= 0
    ? startedAt
    : undefined
}

function cloneMessages(messages: UIMessage[]): UIMessage[] {
  return messages.map(message => ({
    ...message,
    parts: message.parts?.map(part => ({ ...part })),
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

export function useChatTransport(workspaceId?: string) {
  return useMemo(
    () =>
      async (_input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
        const body = init?.body ? JSON.parse(init.body as string) : {}
        const transcript = (body.messages ?? []) as UIMessage[]
        const conversationId =
          typeof body.conversationId === "string" ? body.conversationId : undefined
        if (!conversationId || !workspaceId || body.workspaceId !== workspaceId)
          return errorResponse("REQUEST_FAILED")
        const attemptKey = buildAttemptKey(conversationId, transcript)
        if (!attemptKey) return errorResponse("REQUEST_FAILED")
        const forced = body.compactionMode === "force-overflow-recovery"
        let prepared: PreparedTurn | undefined

        if (forced) {
          prepared = preparedTurnCache.get(body.logicalTurnId ?? attemptKey)
          if (!prepared) return errorResponse("CONTEXT_OVERFLOW")
        } else {
          let mindmapContextText: string | undefined
          let memoryContextText: string | undefined
          const last = transcript[transcript.length - 1]
          const isToolResultRoundtrip =
            last?.role === "assistant" &&
            last.parts?.some(part => String((part as { type?: string }).type).startsWith("tool-"))

          if (getMindmapContextEnabled() && !isToolResultRoundtrip) {
            try {
              mindmapContextText = readCurrentDocumentOutline({
                resolver: { resolve: () => workspaceId },
              }).content
            } catch (error) {
              logger.warn("[useChatTransport] 获取文档大纲失败", { error })
            }
          }
          if (!isToolResultRoundtrip) {
            try {
              const recall = await awaitWithAbort(
                recallForQuery(extractLatestUserText(transcript), getRecentMessageIds(transcript)),
                init?.signal ?? undefined
              )
              memoryContextText = recall?.injectedText
            } catch (error) {
              if (init?.signal?.aborted) throw error
              logger.warn("[useChatTransport] 长期记忆召回失败", { error })
            }
          }
          const requestedModelId = String(body.model ?? "")
          const userPrompt = useAIChatV2Store.getState().mergedUserPrompt || undefined
          prepared = {
            userPrompt,
            memoryContextText,
            mindmapContextText,
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
            force: forced,
            attemptKey,
          },
          init?.signal ?? undefined
        )
      },
    [workspaceId]
  )
}

function errorResponse(errorText: string): Response {
  return createUIMessageStreamResponse({
    stream: createUIMessageStream({
      execute: ({ writer }) => writer.write({ type: "error", errorText }),
    }),
  })
}

export async function runLocalStream(
  input: {
    conversationId: string
    transcript: UIMessage[]
    requestedModelId: string
    systemContent: string
    force: boolean
    attemptKey: string
  },
  signal?: AbortSignal
): Promise<Response> {
  const responseStartedAt = Date.now()
  const turnStartedAt = readTurnStartedAt(input.transcript) ?? responseStartedAt
  try {
    const config = await awaitWithAbort(loadModelsConfig(), signal)
    const resolved = input.requestedModelId
      ? resolveChatModel(config, input.requestedModelId)
      : resolveDefaultChatModel(config)
    const mcpTools = await awaitWithAbort(mcpManager.loadTools(), signal)
    const tools: ToolSet = { ...getAgentTools(), ...mcpTools }
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
      messages: await awaitWithAbort(
        convertToModelMessages(cloneMessages(compacted.messages)),
        signal
      ),
      reasoning: "before-last-message",
      emptyMessages: "remove",
    })
    const result = streamText({
      model: createLanguageModel(resolved.provider, resolved.entry),
      tools,
      system: `${input.systemContent}\n\n---\n\n${describeRuntimeTools(tools)}`,
      messages: modelMessages,
      abortSignal: signal,
      maxRetries: 2,
      maxOutputTokens: resolved.entry.maxOutputTokens,
      stopWhen: stepCountIs(8),
    })
    return result.toUIMessageStreamResponse({
      originalMessages: input.transcript,
      messageMetadata: ({ part }) => {
        if (part.type === "start") {
          return { modelId: resolved.entry.id, responseStartedAt, turnStartedAt }
        }
        if (part.type === "finish") {
          clearPreparedTurn(input.attemptKey)
          return {
            modelId: resolved.entry.id,
            totalUsage: part.totalUsage,
            responseStartedAt,
            responseDurationMs: Date.now() - responseStartedAt,
            turnStartedAt,
            turnDurationMs: Date.now() - turnStartedAt,
          }
        }
      },
      onError: serializeChatError,
    })
  } catch (error) {
    if (signal?.aborted) {
      clearPreparedTurn(input.attemptKey)
      throw error
    }
    if (input.force) clearPreparedTurn(input.attemptKey)
    return errorResponse(input.force ? "CONTEXT_OVERFLOW" : serializeChatError(error))
  }
}
