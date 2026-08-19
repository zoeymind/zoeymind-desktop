/**
 * 拉取 provider 的模型列表 —— 走 Rust 侧 http_get_json (绕开浏览器 CORS 预检).
 *
 * 各厂商 API 返回结构不同, 这里统一成 { id: string }[].
 *
 * 每种 kind 的默认端点 (baseURL 覆盖优先; 会自动去掉用户 baseURL 末尾 /v1 避免拼成 /v1/v1):
 *  - openai / openai-compatible: `{baseURL}/v1/models` (兜底 `{baseURL}/models`)
 *  - anthropic: `https://api.anthropic.com/v1/models`
 *  - ollama: `{baseURL}/api/tags` (default http://localhost:11434)
 *  - gemini: `https://generativelanguage.googleapis.com/v1beta/models?key={apiKey}`
 */
import { invoke } from '@tauri-apps/api/core'
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

/** baseURL 末尾若已带 /v1 或 /v1/, 去掉, 避免 join 出 /v1/v1/models. */
function stripV1Suffix(url: string): string {
  return url.replace(/\/v1\/?$/, '')
}

function joinPath(base: string, path: string): string {
  return `${stripTrailingSlash(base)}/${path.replace(/^\/+/, '')}`
}

async function nativeGetJson<T = unknown>(
  url: string,
  headers: Record<string, string> = {}
): Promise<T> {
  const text = await invoke<string>('http_get_json', { url, headers })
  return JSON.parse(text) as T
}

async function fetchOpenAILike(
  baseURL: string,
  apiKey: string | undefined
): Promise<FetchedModel[]> {
  const headers: Record<string, string> = {}
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`

  // 允许用户传 https://x.com/v1 或 https://x.com; 去 /v1 后自己拼两种.
  const cleanBase = stripV1Suffix(stripTrailingSlash(baseURL))
  const candidates = [joinPath(cleanBase, 'v1/models'), joinPath(cleanBase, 'models')]
  let lastErr: unknown = null
  for (const url of candidates) {
    try {
      const json = await nativeGetJson<{ data?: Array<{ id: string }> }>(url, headers)
      const list = Array.isArray(json.data) ? json.data : []
      if (list.length > 0) return list.map(m => ({ id: m.id }))
    } catch (err) {
      lastErr = err
    }
  }
  throw lastErr ?? new Error('empty model list')
}

async function fetchAnthropic(
  baseURL: string,
  apiKey: string | undefined
): Promise<FetchedModel[]> {
  if (!apiKey) throw new Error('Anthropic 需要 API Key')
  const cleanBase = stripV1Suffix(stripTrailingSlash(baseURL))
  const url = joinPath(cleanBase, 'v1/models')
  const json = await nativeGetJson<{ data?: Array<{ id: string }> }>(url, {
    'x-api-key': apiKey,
    'anthropic-version': '2023-06-01'
  })
  return (json.data ?? []).map(m => ({ id: m.id }))
}

async function fetchOllama(baseURL: string): Promise<FetchedModel[]> {
  const url = joinPath(baseURL, 'api/tags')
  const json = await nativeGetJson<{ models?: Array<{ name: string }> }>(url)
  return (json.models ?? []).map(m => ({ id: m.name }))
}

async function fetchGemini(
  baseURL: string,
  apiKey: string | undefined
): Promise<FetchedModel[]> {
  if (!apiKey) throw new Error('Gemini 需要 API Key')
  const url = `${joinPath(baseURL, 'v1beta/models')}?key=${encodeURIComponent(apiKey)}`
  const json = await nativeGetJson<{ models?: Array<{ name: string }> }>(url)
  return (json.models ?? []).map(m => ({ id: m.name.replace(/^models\//, '') }))
}

/**
 * 拉取给定 provider 的可用模型. 失败抛出错误 (由调用方 toast).
 */
export async function fetchProviderModels(
  provider: ModelProvider
): Promise<FetchedModel[]> {
  const baseURL = provider.baseURL?.trim() || DEFAULT_BASE_URLS[provider.kind] || ''
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
