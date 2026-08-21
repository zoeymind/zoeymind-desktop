import type { UIMessage } from "@ai-sdk/react"
import type { AIModel } from "../hooks/useModelSelector"
import type { UIMessageWithMetadata } from "../types"

export interface MessageTokenUsage {
  usedTokens: number
  maxTokens: number
}

function readTotalTokens(message: UIMessageWithMetadata): number | undefined {
  const usage = message.metadata?.totalUsage
  if (!usage) return undefined

  const total = usage.totalTokens ?? (usage.inputTokens ?? 0) + (usage.outputTokens ?? 0)
  return total > 0 ? total : undefined
}

function resolveModelLimit(
  modelId: string | undefined,
  models: AIModel[],
  fallbackMaxTokens: number
): number {
  if (!modelId) return fallbackMaxTokens
  const model = models.find(candidate => candidate.id === modelId || candidate.configId === modelId)
  return model?.maxContextTokens ?? fallbackMaxTokens
}

export function mapUserMessageTokenUsage(
  messages: UIMessage[],
  models: AIModel[],
  fallbackMaxTokens: number
): ReadonlyMap<string, MessageTokenUsage> {
  const usageByUserMessageId = new Map<string, MessageTokenUsage>()
  let pendingUserMessageId: string | undefined

  for (const message of messages) {
    if (message.role === "user") {
      pendingUserMessageId = message.id
      continue
    }
    if (message.role !== "assistant" || !pendingUserMessageId) continue

    const assistantMessage = message as UIMessageWithMetadata
    const usedTokens = readTotalTokens(assistantMessage)
    if (usedTokens !== undefined) {
      usageByUserMessageId.set(pendingUserMessageId, {
        usedTokens,
        maxTokens: resolveModelLimit(assistantMessage.metadata?.modelId, models, fallbackMaxTokens),
      })
    }
    pendingUserMessageId = undefined
  }

  return usageByUserMessageId
}
