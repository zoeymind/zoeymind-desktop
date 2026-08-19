/**
 * models.json —— AI provider/model 配置。
 *
 * providers[] { id, name, kind, baseURL, apiKey, ... } +
 * models[] { id, providerId, name, capabilities } + defaults。明文存磁盘
 * `<appData>/models.json`（用户已确认接受，桌面端只跑本地 App，key 不上网）。
 */
import { readTextFile, writeTextFile, exists, mkdir } from "@tauri-apps/plugin-fs"
import { appDataDir } from "@tauri-apps/api/path"
import { configFilePath } from "./paths"

export type ProviderKind = "openai" | "anthropic" | "openai-compatible" | "ollama" | "gemini"

export interface ModelProvider {
  id: string
  name: string
  kind: ProviderKind
  baseURL?: string
  apiKey?: string
  organization?: string
}

export interface ModelEntry {
  id: string
  providerId: string // ModelProvider.id
  name: string
  alias: string
  maxContextTokens?: number
  maxOutputTokens?: number
  capabilities?: Array<"chat" | "tools" | "vision" | "embeddings">
}

export interface ModelsConfig {
  providers: ModelProvider[]
  models: ModelEntry[]
  defaults: {
    chat?: string // model.id
    embeddings?: string // model.id
  }
}

const DEFAULT_CONFIG: ModelsConfig = {
  providers: [],
  models: [],
  defaults: {},
}

const DEFAULT_PROVIDER_NAMES: Record<ProviderKind, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  "openai-compatible": "OpenAI Compatible",
  ollama: "Ollama",
  gemini: "Google Gemini",
}

type StoredModelProvider = Omit<ModelProvider, "name"> & { name?: string }
type StoredModelEntry = Omit<ModelEntry, "providerId" | "alias"> & {
  providerId?: string
  provider?: string
  alias?: string
}

interface StoredModelsConfig {
  providers?: StoredModelProvider[]
  models?: StoredModelEntry[]
  defaults?: ModelsConfig["defaults"]
}

function normalizeConfig(parsed: StoredModelsConfig): ModelsConfig {
  const providers = (parsed.providers ?? []).map((provider, index) => ({
    ...provider,
    name: provider.name?.trim() || `${DEFAULT_PROVIDER_NAMES[provider.kind]} ${index + 1}`,
  }))
  const providerIds = new Set(providers.map(provider => provider.id))
  const models = (parsed.models ?? []).flatMap(model => {
    const providerId = model.providerId ?? model.provider
    if (!providerId || !providerIds.has(providerId)) return []
    const { provider: _legacyProvider, ...rest } = model
    void _legacyProvider
    return [{ ...rest, providerId, alias: model.alias?.trim() || model.name }]
  })

  return {
    providers,
    models,
    defaults: parsed.defaults ?? {},
  }
}

export async function loadModelsConfig(): Promise<ModelsConfig> {
  const path = await configFilePath("models.json")
  if (!(await exists(path))) return { ...DEFAULT_CONFIG }
  try {
    const raw = await readTextFile(path)
    const parsed = JSON.parse(raw) as StoredModelsConfig
    return normalizeConfig(parsed)
  } catch {
    return { ...DEFAULT_CONFIG }
  }
}

export async function saveModelsConfig(cfg: ModelsConfig): Promise<void> {
  const dir = await appDataDir()
  if (!(await exists(dir))) {
    await mkdir(dir, { recursive: true })
  }
  const path = await configFilePath("models.json")
  await writeTextFile(path, JSON.stringify(cfg, null, 2))
}
