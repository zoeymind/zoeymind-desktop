/**
 * models.json —— AI provider/model 配置。
 *
 * 参考 OMP models config：providers[] { id, kind, baseURL, apiKey, ... } +
 * models[] { id, provider, name, capabilities } + defaults。明文存磁盘
 * `<appData>/models.json`（用户已确认接受，桌面端只跑本地 App，key 不上网）。
 */
import { readTextFile, writeTextFile, exists, mkdir } from '@tauri-apps/plugin-fs'
import { appDataDir } from '@tauri-apps/api/path'
import { configFilePath } from './paths'

export type ProviderKind = 'openai' | 'anthropic' | 'openai-compatible' | 'ollama' | 'gemini'

export interface ModelProvider {
  id: string
  kind: ProviderKind
  baseURL?: string
  apiKey?: string
  organization?: string
}

export interface ModelEntry {
  id: string
  provider: string // provider.id
  name: string
  capabilities?: Array<'chat' | 'tools' | 'vision' | 'embeddings'>
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
  defaults: {}
}

export async function loadModelsConfig(): Promise<ModelsConfig> {
  const path = await configFilePath('models.json')
  if (!(await exists(path))) return { ...DEFAULT_CONFIG }
  try {
    const raw = await readTextFile(path)
    const parsed = JSON.parse(raw) as Partial<ModelsConfig>
    return {
      providers: parsed.providers ?? [],
      models: parsed.models ?? [],
      defaults: parsed.defaults ?? {}
    }
  } catch {
    return { ...DEFAULT_CONFIG }
  }
}

export async function saveModelsConfig(cfg: ModelsConfig): Promise<void> {
  const dir = await appDataDir()
  if (!(await exists(dir))) {
    await mkdir(dir, { recursive: true })
  }
  const path = await configFilePath('models.json')
  await writeTextFile(path, JSON.stringify(cfg, null, 2))
}
