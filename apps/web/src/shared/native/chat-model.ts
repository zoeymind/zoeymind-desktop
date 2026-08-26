import { createAnthropic } from "@ai-sdk/anthropic"
import { createGoogleGenerativeAI } from "@ai-sdk/google"
import { createOpenAI } from "@ai-sdk/openai"
import { createOpenAICompatible } from "@ai-sdk/openai-compatible"
import type { LanguageModel } from "ai"
import { nativeFetch } from "./native-fetch"
import type { ModelEntry, ModelProvider, ModelsConfig } from "./models-config"

export class UnknownModelError extends Error {
  readonly code = "UNKNOWN_MODEL"

  constructor(modelId: string) {
    super(`UNKNOWN_MODEL: ${modelId}`)
    this.name = "UnknownModelError"
  }
}

export interface ResolvedContextBudget {
  contextWindow: number
  maxOutputTokens: number
  reserveTokens: number
  triggerTokens: number
  keepRecentTokens: number
}

export function resolveChatModel(
  cfg: ModelsConfig,
  requestedModelId: string
): { entry: ModelEntry; provider: ModelProvider } {
  const requested = requestedModelId.trim()
  const entry = cfg.models.find(model => model.id === requested || model.name === requested)
  if (!entry) throw new UnknownModelError(requested)
  const provider = cfg.providers.find(candidate => candidate.id === entry.providerId)
  if (!provider) throw new Error(`MODEL_PROVIDER_NOT_FOUND: ${entry.providerId}`)
  return { entry, provider }
}

export function resolveDefaultChatModel(cfg: ModelsConfig): {
  entry: ModelEntry
  provider: ModelProvider
} {
  const requested = cfg.defaults.chat
  if (requested) return resolveChatModel(cfg, requested)
  const entry = cfg.models[0]
  if (!entry) throw new Error("NO_CHAT_MODEL_CONFIGURED")
  const provider = cfg.providers.find(candidate => candidate.id === entry.providerId)
  if (!provider) throw new Error(`MODEL_PROVIDER_NOT_FOUND: ${entry.providerId}`)
  return { entry, provider }
}

export function resolveContextBudget(
  entry: ModelEntry,
  compactionThresholdPercent = 85
): ResolvedContextBudget {
  const contextWindow = entry.maxContextTokens ?? 128_000
  const maxOutputTokens = entry.maxOutputTokens ?? 4_096
  const reserveTokens = Math.max(maxOutputTokens, Math.floor(contextWindow * 0.15))
  const normalizedThreshold = Math.min(95, Math.max(50, compactionThresholdPercent))
  const triggerTokens = Math.max(1, Math.floor(contextWindow * (normalizedThreshold / 100)))
  const keepRecentTokens = Math.min(16_000, Math.max(4_000, Math.floor(contextWindow * 0.1)))
  return { contextWindow, maxOutputTokens, reserveTokens, triggerTokens, keepRecentTokens }
}

function resolveBaseURL(provider: ModelProvider): string | undefined {
  const configured = provider.baseURL?.trim()
  if (configured) return configured.replace(/\/+$/, "").replace(/\/v1$/, "")
  if (provider.kind === "openai") return "https://api.openai.com"
  if (provider.kind === "ollama") return "http://localhost:11434"
  return undefined
}

export function createLanguageModel(provider: ModelProvider, entry: ModelEntry): LanguageModel {
  const baseURL = resolveBaseURL(provider)
  switch (provider.kind) {
    case "openai":
      return createOpenAI({
        baseURL: baseURL ? `${baseURL}/v1` : undefined,
        apiKey: provider.apiKey ?? "",
        fetch: nativeFetch,
      }).chat(entry.name)
    case "openai-compatible":
    case "ollama":
      return createOpenAICompatible({
        name: provider.kind === "ollama" ? "ollama" : "openai-compatible",
        baseURL: baseURL ? `${baseURL}/v1` : "http://localhost:11434/v1",
        apiKey: provider.apiKey || undefined,
        fetch: nativeFetch,
      })(entry.name)
    case "anthropic":
      return createAnthropic({
        baseURL: baseURL ? `${baseURL}/v1` : undefined,
        apiKey: provider.apiKey ?? "",
        fetch: nativeFetch,
        headers: { "anthropic-dangerous-direct-browser-access": "true" },
      })(entry.name)
    case "gemini":
      return createGoogleGenerativeAI({
        baseURL: baseURL ? `${baseURL}/v1beta` : undefined,
        apiKey: provider.apiKey ?? "",
        fetch: nativeFetch,
      })(entry.name)
  }
}
