/**
 * 拉取 provider 的模型列表 —— 各厂商 API 返回结构不同, 这里统一成 { id: string }[].
 *
 * 每种 kind 的默认端点 (baseURL 覆盖优先):
 *  - openai / openai-compatible: `${baseURL}/v1/models` (兜底 `${baseURL}/models`)
 *  - anthropic: `https://api.anthropic.com/v1/models` (需要 anthropic-version + dangerous-direct-browser-access)
 *  - ollama: `${baseURL}/api/tags` (default baseURL = http://localhost:11434)
 *  - gemini: `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
 */
import type { ModelProvider } from './models-config'

export interface FetchedModel {
  id: string
}

const DEFAULT_BASE_URLS: Partial<Record<ModelProvider['kind'], string>> = {
  openai: 'https://api.openai.com',
  anthropic: 'https://api.anthropic.com',
  ollama: 'http://localhost:11434',
  gemini: 'https://generativelanguage.googleapis.com'
}

function stripTrailingSlash(url: string): string {
  return url.replace(/\/+$/, '')
}

function joinPath(base: string, path: string): string {
  return `${stripTrailingSlash(base)}/${path.replace(/^\/+/, '')}`
}

async function fetchJson(url: string, init?: RequestInit): Promise<unknown> {
  const resp = await fetch(url, init)
  if (!resp.ok) {
    throw new Error(`HTTP ${resp.status}: ${await resp.text().catch(() => resp.statusText)}`)
  }
  return resp.json()
}

// OpenAI 风格: { data: [{ id: "gpt-4o", ... }] }
async function fetchOpenAILike(baseURL: string, apiKey: string | undefined): Promise<FetchedModel[]> {
  const headers: Record<string, string> = {}
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`

  // 先试 /v1/models, 失败退回 /models (兼容有些 baseURL 已经含 /v1 或不含 /v1)
  const candidates = [joinPath(baseURL, 'v1/models'), joinPath(baseURL, 'models')]
  let lastErr: unknown = null
  for (const url of candidates) {
    try {
      const json = (await fetchJson(url, { headers })) as { data?: Array<{ id: string }> }
      const list = Array.isArray(json.data) ? json.data : []
      if (list.length > 0) return list.map(m => ({ id: m.id }))
    } catch (err) {
      lastErr = err
    }
  }
  throw lastErr ?? new Error('empty model list')
}

async function fetchAnthropic(baseURL: string, apiKey: string | undefined): Promise<FetchedModel[]> {
  if (!apiKey) throw new Error('Anthropic 需要 API Key')
  const url = joinPath(baseURL, 'v1/models')
  const json = (await fetchJson(url, {
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true'
    }
  })) as { data?: Array<{ id: string }> }
  return (json.data ?? []).map(m => ({ id: m.id }))
}

async function fetchOllama(baseURL: string): Promise<FetchedModel[]> {
  const url = joinPath(baseURL, 'api/tags')
  const json = (await fetchJson(url)) as { models?: Array<{ name: string }> }
  return (json.models ?? []).map(m => ({ id: m.name }))
}

async function fetchGemini(baseURL: string, apiKey: string | undefined): Promise<FetchedModel[]> {
  if (!apiKey) throw new Error('Gemini 需要 API Key')
  const url = `${joinPath(baseURL, 'v1beta/models')}?key=${encodeURIComponent(apiKey)}`
  const json = (await fetchJson(url)) as { models?: Array<{ name: string }> }
  // Gemini 返回 name = "models/gemini-1.5-pro", 只取最后一段
  return (json.models ?? []).map(m => ({
    id: m.name.replace(/^models\//, '')
  }))
}

/**
 * 拉取给定 provider 的可用模型. 失败抛出错误 (由调用方 toast).
 */
export async function fetchProviderModels(provider: ModelProvider): Promise<FetchedModel[]> {
  const baseURL =
    provider.baseURL?.trim() || DEFAULT_BASE_URLS[provider.kind] || ''
  if (!baseURL) {
    throw new Error(`${provider.kind} 需要 Base URL`)
  }

  switch (provider.kind) {
    case 'openai':
    case 'openai-compatible':
      return fetchOpenAILike(baseURL, provider.apiKey)
    case 'anthropic':
      return fetchAnthropic(baseURL, provider.apiKey)
    case 'ollama':
      return fetchOllama(baseURL)
    case 'gemini':
      return fetchGemini(baseURL, provider.apiKey)
    default:
      throw new Error(`不支持的 provider kind: ${String(provider.kind)}`)
  }
}
